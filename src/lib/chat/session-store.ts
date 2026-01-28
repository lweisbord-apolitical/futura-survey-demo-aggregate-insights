import type { ChatSessionState } from "./types";
import { requireSupabase } from "@/lib/supabase";

/**
 * Session store with Supabase persistence
 * Requires Supabase to be configured - fails explicitly if not
 */
class SessionStore {
  private readonly SESSION_TTL_MS = 60 * 60 * 1000; // 1 hour

  /**
   * Create a new session
   */
  async create(sessionId: string, jobTitle: string, occupationCode?: string): Promise<ChatSessionState> {
    const supabase = requireSupabase();

    const session: ChatSessionState = {
      sessionId,
      jobTitle,
      occupationCode,
      messages: [],
      extractedTasks: [],
      selectedSuggestionIds: [],
      turnCount: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const { error } = await supabase
      .from("chat_sessions")
      .insert({
        session_id: sessionId,
        job_title: jobTitle,
        occupation_code: occupationCode || null,
        messages: [],
        extracted_tasks: [],
        selected_suggestion_ids: [],
        turn_count: 0,
      });

    if (error) {
      console.error("Failed to create session in Supabase:", error);
      throw new Error(`Failed to create session: ${error.message}`);
    }

    return session;
  }

  /**
   * Get a session by ID
   */
  async get(sessionId: string): Promise<ChatSessionState | undefined> {
    const supabase = requireSupabase();

    const { data, error } = await supabase
      .from("chat_sessions")
      .select("*")
      .eq("session_id", sessionId)
      .single();

    if (error || !data) {
      return undefined;
    }

    // Check if expired (1 hour)
    const updatedAt = new Date(data.updated_at).getTime();
    if (Date.now() - updatedAt > this.SESSION_TTL_MS) {
      await this.delete(sessionId);
      return undefined;
    }

    return this.mapFromDb(data);
  }

  /**
   * Update a session
   */
  async update(sessionId: string, updates: Partial<ChatSessionState>): Promise<ChatSessionState | undefined> {
    const supabase = requireSupabase();

    const session = await this.get(sessionId);
    if (!session) return undefined;

    const updated: ChatSessionState = {
      ...session,
      ...updates,
      updatedAt: new Date().toISOString(),
    };

    const { error } = await supabase
      .from("chat_sessions")
      .update({
        job_title: updated.jobTitle,
        occupation_code: updated.occupationCode || null,
        messages: updated.messages,
        extracted_tasks: updated.extractedTasks,
        selected_suggestion_ids: updated.selectedSuggestionIds,
        turn_count: updated.turnCount,
      })
      .eq("session_id", sessionId);

    if (error) {
      console.error("Failed to update session in Supabase:", error);
      throw new Error(`Failed to update session: ${error.message}`);
    }

    return updated;
  }

  /**
   * Delete a session
   */
  async delete(sessionId: string): Promise<boolean> {
    const supabase = requireSupabase();

    const { error } = await supabase
      .from("chat_sessions")
      .delete()
      .eq("session_id", sessionId);

    if (error) {
      console.error("Failed to delete session from Supabase:", error);
      return false;
    }

    return true;
  }

  /**
   * Check if session exists
   */
  async has(sessionId: string): Promise<boolean> {
    const session = await this.get(sessionId);
    return session !== undefined;
  }

  // Helper: map database row to ChatSessionState
  private mapFromDb(data: {
    session_id: string;
    job_title: string;
    occupation_code: string | null;
    messages: ChatSessionState["messages"];
    extracted_tasks: ChatSessionState["extractedTasks"];
    selected_suggestion_ids: string[];
    turn_count: number;
    created_at: string;
    updated_at: string;
  }): ChatSessionState {
    return {
      sessionId: data.session_id,
      jobTitle: data.job_title,
      occupationCode: data.occupation_code || undefined,
      messages: data.messages || [],
      extractedTasks: data.extracted_tasks || [],
      selectedSuggestionIds: data.selected_suggestion_ids || [],
      turnCount: data.turn_count,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    };
  }
}

// Export singleton instance
export const sessionStore = new SessionStore();
