import { mockResponses, type MockContext } from "./mockResponses";

// Shared router for all AI agent calls. Provider is controlled by
// NEXT_PUBLIC_AI_PROVIDER — 'mock' (default) returns hand-written
// responses after a 1-2s delay; a real provider would call the LLM
// directly. Called inline from API routes, no worker needed.
export async function generateAI(
  agent: keyof typeof mockResponses,
  task: string,
  context: MockContext,
): Promise<unknown> {
  const provider = process.env.NEXT_PUBLIC_AI_PROVIDER || "mock";

  if (provider !== "mock") {
    // TODO: call the real LLM provider (Gemini, etc.) via lib/agents/*.ts.
    console.warn(`generateAI: provider="${provider}" not yet wired, falling back to mock`);
  }

  const delay = 1000 + Math.random() * 1000;
  await new Promise((r) => setTimeout(r, delay));

  const taskFn = (mockResponses[agent] as Record<string, (ctx: MockContext) => unknown> | undefined)?.[task];
  if (!taskFn) {
    throw new Error(`generateAI: no mock response for ${agent}/${task}`);
  }
  const response = taskFn(context);

  console.log("generateAI", { agent, task, input_context: context, mock_response: response });
  return response;
}
