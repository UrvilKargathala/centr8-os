import { mockResponses, type MockContext } from "./mockResponses";
import { getSystemPrompt, buildPrompt } from "./prompts";

// Shared router for all AI agent calls. Provider is controlled by
// NEXT_PUBLIC_AI_PROVIDER — 'mock' returns hand-written responses,
// 'openrouter' calls the real LLM via OpenRouter's API.
export async function generateAI(
  agent: keyof typeof mockResponses,
  task: string,
  context: MockContext,
): Promise<unknown> {
  const provider = process.env.NEXT_PUBLIC_AI_PROVIDER || "mock";

  if (provider === "openrouter") {
    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
      console.warn("generateAI: OPENROUTER_API_KEY missing, falling back to mock");
      return runMock(agent, task, context);
    }
    return callOpenRouter(agent, task, context, apiKey);
  }

  return runMock(agent, task, context);
}

async function runMock(agent: keyof typeof mockResponses, task: string, context: MockContext): Promise<unknown> {
  const delay = 1000 + Math.random() * 1000;
  await new Promise((r) => setTimeout(r, delay));

  const taskFn = (mockResponses[agent] as Record<string, (ctx: MockContext) => unknown> | undefined)?.[task];
  if (!taskFn) {
    throw new Error(`generateAI: no mock response for ${agent}/${task}`);
  }
  return taskFn(context);
}

async function callOpenRouter(
  agent: string,
  task: string,
  context: MockContext,
  apiKey: string,
): Promise<unknown> {
  const built = buildPrompt(agent, task, context);
  if (!built) {
    console.warn(`generateAI: no prompt template for ${agent}/${task}, falling back to mock`);
    return runMock(agent as keyof typeof mockResponses, task, context);
  }

  const systemPrompt = getSystemPrompt(agent);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30_000);

  let raw: string;
  try {
    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemma-4-31b-it:free",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: built.prompt },
        ],
        temperature: 0.7,
      }),
      signal: controller.signal,
    });

    if (res.status === 429) {
      throw new Error("AI rate limit reached — try again in a moment, or switch back to demo mode in settings");
    }
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`OpenRouter ${res.status}: ${body.slice(0, 200)}`);
    }

    const data = await res.json();
    raw = data.choices?.[0]?.message?.content ?? "";
  } catch (err: unknown) {
    if (err instanceof DOMException && err.name === "AbortError") {
      throw new Error("AI request timed out — please try again");
    }
    throw err;
  } finally {
    clearTimeout(timeout);
  }

  if (!built.json) return raw;

  return parseJsonResponse(raw, agent, task);
}

function parseJsonResponse(raw: string, agent: string, task: string): unknown {
  // Strip markdown fences if the model wrapped its response
  let cleaned = raw.trim();
  if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/^```(?:json)?\s*/, "").replace(/```\s*$/, "").trim();
  }

  try {
    return JSON.parse(cleaned);
  } catch {
    console.warn(`generateAI: JSON parse failed for ${agent}/${task}, attempting extraction`);
    // Try to find JSON object/array in the response
    const match = cleaned.match(/[\[{][\s\S]*[\]}]/);
    if (match) {
      try {
        return JSON.parse(match[0]);
      } catch {
        // fall through
      }
    }
    console.error(`generateAI: could not parse response for ${agent}/${task}:`, cleaned.slice(0, 300));
    throw new Error("AI returned an invalid response — please try again");
  }
}
