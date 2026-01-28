import { ChatAnthropic } from "@langchain/anthropic";
import {
  StateGraph,
  MessagesAnnotation,
  MemorySaver
} from "@langchain/langgraph";
import { SystemMessage, HumanMessage, AIMessage, BaseMessage } from "@langchain/core/messages";

// Create the model
const model = new ChatAnthropic({
  model: "claude-sonnet-4-20250514",
  maxTokens: 1024,
});

// Define the graph node that calls the model
async function callModel(
  state: typeof MessagesAnnotation.State
): Promise<{ messages: BaseMessage[] }> {
  const response = await model.invoke(state.messages);
  return { messages: [response] };
}

// Build the graph
const workflow = new StateGraph(MessagesAnnotation)
  .addNode("model", callModel)
  .addEdge("__start__", "model")
  .addEdge("model", "__end__");

// Create in-memory checkpointer for conversation persistence
// This can be upgraded to PostgresSaver for production
const checkpointer = new MemorySaver();

// Compile the graph with checkpointing
export const graph = workflow.compile({ checkpointer });

// Helper to create the initial messages with system prompt and context
export function createInitialMessages(
  systemPrompt: string,
  scenarioContext: string
): BaseMessage[] {
  const fullSystemPrompt = `${systemPrompt}

Context for this learning scenario:
${scenarioContext}`;

  return [new SystemMessage(fullSystemPrompt)];
}

// Helper to convert message format
export function toGraphMessages(
  messages: { role: 'user' | 'assistant'; content: string }[]
): BaseMessage[] {
  return messages.map(m =>
    m.role === 'user'
      ? new HumanMessage(m.content)
      : new AIMessage(m.content)
  );
}

// Export types for use in API routes
export type { BaseMessage };
