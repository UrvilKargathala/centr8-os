import { mockResponses, type MockContext } from "./mockResponses";

// Shared router for the New Project wizard's AI touchpoints. Provider is
// controlled by NEXT_PUBLIC_AI_PROVIDER — 'mock' (default) returns
// hand-written responses after a 1-2s delay; 'groq' / 'gemini' would route
// through the existing /api/agent-job pipeline. That branch is intentionally
// a TODO stub — the code path exists so switching providers is a config
// change, not a rewrite.
export async function generateAI(
  agent: keyof typeof mockResponses,
  task: string,
  context: MockContext,
): Promise<unknown> {
  const provider = process.env.NEXT_PUBLIC_AI_PROVIDER || "mock";

  if (provider !== "mock") {
    // TODO: route through /api/agent-job with { agent, task, context } and
    // poll the returned job id until done. Same shape as the mock — callers
    // don't need to know which path ran.
    console.warn(`generateAI: provider="${provider}" not yet wired to /api/agent-job, falling back to mock`);
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
