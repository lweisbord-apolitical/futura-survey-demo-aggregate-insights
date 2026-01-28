import OpenAI from "openai";

/**
 * LLM Service for chat agent
 * Uses OpenAI GPT-4 for task elicitation conversations
 */
class LLMService {
  private client: OpenAI | null = null;
  private model: string = "gpt-4o";

  private getClient(): OpenAI {
    if (!this.client) {
      const apiKey = process.env.OPENAI_API_KEY;
      if (!apiKey) {
        throw new Error("OPENAI_API_KEY environment variable is not set");
      }
      this.client = new OpenAI({ apiKey });
    }
    return this.client;
  }

  /**
   * Generate a text response from the LLM
   */
  async generate(prompt: string, systemPrompt?: string): Promise<string> {
    const client = this.getClient();

    const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [];

    if (systemPrompt) {
      messages.push({ role: "system", content: systemPrompt });
    }

    messages.push({ role: "user", content: prompt });

    const response = await client.chat.completions.create({
      model: this.model,
      messages,
      temperature: 0.7,
      max_tokens: 500,
    });

    return response.choices[0]?.message?.content || "";
  }

  /**
   * Generate a streaming text response from the LLM
   * Returns an async generator that yields text chunks
   */
  async *generateStream(
    prompt: string,
    systemPrompt?: string
  ): AsyncGenerator<string, void, unknown> {
    const client = this.getClient();

    const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [];

    if (systemPrompt) {
      messages.push({ role: "system", content: systemPrompt });
    }

    messages.push({ role: "user", content: prompt });

    const stream = await client.chat.completions.create({
      model: this.model,
      messages,
      temperature: 0.7,
      max_tokens: 500,
      stream: true,
    });

    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content;
      if (content) {
        yield content;
      }
    }
  }

  /**
   * Generate a JSON response from the LLM
   */
  async generateJSON<T>(prompt: string, systemPrompt?: string): Promise<T> {
    const client = this.getClient();

    const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [];

    const jsonSystemPrompt = `${systemPrompt || ""}
You must respond with valid JSON only. No additional text or explanation.`;

    messages.push({ role: "system", content: jsonSystemPrompt.trim() });
    messages.push({ role: "user", content: prompt });

    const response = await client.chat.completions.create({
      model: this.model,
      messages,
      temperature: 0.3, // Lower temperature for more consistent JSON
      max_tokens: 1000,
      response_format: { type: "json_object" },
    });

    const content = response.choices[0]?.message?.content || "{}";

    try {
      return JSON.parse(content) as T;
    } catch (error) {
      console.error("Failed to parse LLM JSON response:", content);
      throw new Error("LLM returned invalid JSON");
    }
  }

  /**
   * Check if the LLM service is configured
   */
  isConfigured(): boolean {
    return !!process.env.OPENAI_API_KEY;
  }
}

// Export singleton instance
export const llmService = new LLMService();
