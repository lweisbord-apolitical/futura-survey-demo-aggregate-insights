import { NextRequest } from "next/server";
import { chatService } from "@/lib/chat";

/**
 * POST /api/chat/stream
 * Process a chat message with streaming response
 * Uses Server-Sent Events (SSE) to stream the response
 *
 * Two modes:
 * 1. New session: { jobTitle, initialTasks?, occupationCode? } - creates session and streams response
 * 2. Existing session: { sessionId, message } - processes message and streams response
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { sessionId, message, jobTitle, initialTasks, occupationCode } = body;

    // Determine if this is a new session or existing session
    const isNewSession = !sessionId && jobTitle;

    if (!isNewSession) {
      // Existing session flow - validate inputs
      if (!sessionId) {
        return new Response(
          JSON.stringify({ error: "sessionId is required for existing sessions" }),
          { status: 400, headers: { "Content-Type": "application/json" } }
        );
      }

      if (!message) {
        return new Response(
          JSON.stringify({ error: "message is required" }),
          { status: 400, headers: { "Content-Type": "application/json" } }
        );
      }

      // Check if session exists
      const session = await chatService.getSession(sessionId);
      if (!session) {
        return new Response(
          JSON.stringify({ error: "Session not found or expired" }),
          { status: 404, headers: { "Content-Type": "application/json" } }
        );
      }
    }

    // Create a readable stream for SSE
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        try {
          // Choose the appropriate streaming method
          const streamGenerator = isNewSession
            ? chatService.startSessionStream(jobTitle, occupationCode, initialTasks)
            : chatService.processMessageStream(sessionId, message);

          for await (const event of streamGenerator) {
            if (event.type === "chunk") {
              // Send text chunk
              const data = JSON.stringify({ type: "chunk", content: event.content });
              controller.enqueue(encoder.encode(`data: ${data}\n\n`));
            } else if (event.type === "done") {
              // Send final response with metadata
              const data = JSON.stringify({ type: "done", ...event.response });
              controller.enqueue(encoder.encode(`data: ${data}\n\n`));
            }
          }
          controller.close();
        } catch (error) {
          console.error("Streaming error:", error);
          const errorData = JSON.stringify({
            type: "error",
            error: error instanceof Error ? error.message : "Streaming failed"
          });
          controller.enqueue(encoder.encode(`data: ${errorData}\n\n`));
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
      },
    });
  } catch (error) {
    console.error("Chat stream API error:", error);
    return new Response(
      JSON.stringify({
        error: "Failed to process request",
        details: error instanceof Error ? error.message : "Unknown error"
      }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
