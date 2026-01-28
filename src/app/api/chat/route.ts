import { NextRequest, NextResponse } from "next/server";
import { chatService } from "@/lib/chat";
import type { SendMessageRequest, StartSessionRequest } from "@/lib/chat/types";

/**
 * POST /api/chat
 * Process a chat message or start a new session
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Check if this is a start session request (no sessionId or message)
    if (!body.sessionId && !body.message) {
      return handleStartSession(body as StartSessionRequest);
    }

    // Otherwise, process as a message
    return handleSendMessage(body as SendMessageRequest);
  } catch (error) {
    console.error("Chat API error:", error);
    return NextResponse.json(
      { error: "Failed to process request", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}

/**
 * Start a new chat session
 */
async function handleStartSession(body: StartSessionRequest) {
  const { jobTitle, occupationCode, initialTasks } = body;

  if (!jobTitle) {
    return NextResponse.json(
      { error: "jobTitle is required" },
      { status: 400 }
    );
  }

  const result = await chatService.startSession(jobTitle, occupationCode, initialTasks);

  return NextResponse.json(result, { status: 201 });
}

/**
 * Process a user message
 */
async function handleSendMessage(body: SendMessageRequest) {
  const { sessionId, message, jobTitle, occupationCode } = body;

  // Validate required fields
  if (!message) {
    return NextResponse.json(
      { error: "message is required" },
      { status: 400 }
    );
  }

  // If no sessionId, start a new session first
  let activeSessionId = sessionId;
  if (!activeSessionId) {
    if (!jobTitle) {
      return NextResponse.json(
        { error: "jobTitle is required when starting a new session" },
        { status: 400 }
      );
    }

    const newSession = await chatService.startSession(jobTitle, occupationCode);
    activeSessionId = newSession.sessionId;
  }

  // Check if session exists
  const session = await chatService.getSession(activeSessionId);
  if (!session) {
    return NextResponse.json(
      { error: "Session not found or expired" },
      { status: 404 }
    );
  }

  // Process the message
  const result = await chatService.processMessage(activeSessionId, message);

  return NextResponse.json(result);
}

/**
 * GET /api/chat?sessionId=xxx
 * Get session state
 */
export async function GET(request: NextRequest) {
  try {
    const sessionId = request.nextUrl.searchParams.get("sessionId");

    if (!sessionId) {
      return NextResponse.json(
        { error: "sessionId query parameter is required" },
        { status: 400 }
      );
    }

    const session = await chatService.getSession(sessionId);

    if (!session) {
      return NextResponse.json(
        { error: "Session not found or expired" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      sessionId: session.sessionId,
      jobTitle: session.jobTitle,
      occupationCode: session.occupationCode,
      messages: session.messages,
      extractedTasks: session.extractedTasks,
      turnCount: session.turnCount,
    });
  } catch (error) {
    console.error("Chat GET API error:", error);
    return NextResponse.json(
      { error: "Failed to get session" },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/chat
 * Update session (e.g., select suggestions)
 */
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { sessionId, selectedSuggestionIds } = body;

    if (!sessionId) {
      return NextResponse.json(
        { error: "sessionId is required" },
        { status: 400 }
      );
    }

    const session = await chatService.getSession(sessionId);
    if (!session) {
      return NextResponse.json(
        { error: "Session not found or expired" },
        { status: 404 }
      );
    }

    if (selectedSuggestionIds) {
      await chatService.selectSuggestions(sessionId, selectedSuggestionIds);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Chat PATCH API error:", error);
    return NextResponse.json(
      { error: "Failed to update session" },
      { status: 500 }
    );
  }
}
