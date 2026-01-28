import { NextResponse } from 'next/server';
import { graph, createInitialMessages, toGraphMessages } from '@/lib/graph';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface ChatRequest {
  messages: ChatMessage[];
  system_prompt: string;
  scenario_context: string;
  thread_id: string;
}

export async function POST(request: Request) {
  try {
    const body: ChatRequest = await request.json();
    const { messages, system_prompt, scenario_context, thread_id } = body;

    // Build the full message list with system prompt
    const systemMessages = createInitialMessages(system_prompt, scenario_context);
    const conversationMessages = toGraphMessages(messages);
    const allMessages = [...systemMessages, ...conversationMessages];

    // Configure with thread_id for conversation memory
    const config = {
      configurable: { thread_id: thread_id || 'default' }
    };

    // Invoke the graph
    const result = await graph.invoke(
      { messages: allMessages },
      config
    );

    // Get the last message (AI response)
    const lastMessage = result.messages[result.messages.length - 1];
    const content = typeof lastMessage.content === 'string'
      ? lastMessage.content
      : '';

    return NextResponse.json({ content });
  } catch (error) {
    console.error('Chat API error:', error);

    if (error instanceof Error) {
      if (error.message.includes('API key')) {
        return NextResponse.json(
          { error: 'API key not configured. Please set ANTHROPIC_API_KEY environment variable.' },
          { status: 500 }
        );
      }
    }

    return NextResponse.json(
      { error: 'Failed to generate response' },
      { status: 500 }
    );
  }
}

// Streaming endpoint for real-time token delivery
export async function PUT(request: Request) {
  try {
    const body: ChatRequest = await request.json();
    const { messages, system_prompt, scenario_context, thread_id } = body;

    const systemMessages = createInitialMessages(system_prompt, scenario_context);
    const conversationMessages = toGraphMessages(messages);
    const allMessages = [...systemMessages, ...conversationMessages];

    const config = {
      configurable: { thread_id: thread_id || 'default' }
    };

    // Create a streaming response
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        try {
          // Stream with messages mode for token-by-token output
          for await (const [messageChunk, metadata] of await graph.stream(
            { messages: allMessages },
            { ...config, streamMode: 'messages' }
          )) {
            if (messageChunk.content) {
              const chunk = typeof messageChunk.content === 'string'
                ? messageChunk.content
                : '';
              if (chunk) {
                controller.enqueue(encoder.encode(`data: ${JSON.stringify({ content: chunk })}\n\n`));
              }
            }
          }
          controller.enqueue(encoder.encode('data: [DONE]\n\n'));
          controller.close();
        } catch (error) {
          console.error('Streaming error:', error);
          controller.error(error);
        }
      }
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });
  } catch (error) {
    console.error('Stream API error:', error);
    return NextResponse.json(
      { error: 'Failed to start stream' },
      { status: 500 }
    );
  }
}
