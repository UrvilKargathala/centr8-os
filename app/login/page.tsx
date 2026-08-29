"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Field, FieldGroup, FieldLabel, FieldDescription, FieldError } from "@/components/ui/field";

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}

// Structured like shadcn's login-01 block (Card + Field/FieldGroup), but
// with the OAuth button and "Sign up" link dropped — this app has no OAuth
// provider configured and no self-serve signup (invite-only org membership,
// see /admin/members) — and wired to real Supabase email/password auth
// rather than the block's static markup.
function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) {
      setError(error.message);
      return;
    }
    fetch("/api/me/record-login", { method: "POST" }).catch(() => {});
    router.push(searchParams.get("next") || "/dashboard");
    router.refresh();
  }

  return (
    <div className="flex min-h-screen bg-white">
      {/* Decorative side — purely illustrative (skeleton placeholder bars,
          no invented stats/numbers), hidden below md same as the reference's
          split layout collapsing to a single column on mobile. */}
      <div className="relative hidden w-1/2 items-center justify-center overflow-hidden bg-primary-100 p-10 md:flex">
        <div className="absolute -left-24 -top-24 h-72 w-72 rounded-full bg-primary-100 blur-3xl" />
        <div className="absolute -bottom-24 -right-16 h-72 w-72 rounded-full bg-primary-600/20 blur-3xl" />

        <div className="relative w-full max-w-sm space-y-6">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-sm bg-primary-600 text-body-medium font-semibold text-neutral-50">
              C8
            </div>
            <span className="text-h3 font-semibold text-neutral-950">Centr8 OS</span>
          </div>
          <div>
            <h2 className="text-h1 font-semibold text-neutral-950">The AI-native operating system for work</h2>
            <p className="mt-2 text-body text-neutral-600">
              Projects, HR, and CRM in one place — with an AI project manager that plans, monitors, and executes
              alongside you.
            </p>
          </div>

          <AiFlowIllustration />
        </div>
      </div>

      {/* Form side */}
      <div className="flex w-full items-center justify-center bg-white px-6 py-12 md:w-1/2">
        <div className="w-full max-w-sm">
          <form onSubmit={handleSubmit}>
            <FieldGroup>
              <div className="flex flex-col gap-2 md:hidden">
                <div className="flex h-9 w-9 items-center justify-center rounded-sm bg-primary-600 text-body-medium font-semibold text-neutral-50">
                  C8
                </div>
              </div>
              <div>
                <h1 className="text-h1 font-semibold text-neutral-950">Welcome back</h1>
                <FieldDescription>Sign in to your Centr8 OS workspace.</FieldDescription>
              </div>

              <Field data-invalid={!!error}>
                <FieldLabel htmlFor="email">Email</FieldLabel>
                <Input
                  id="email"
                  type="email"
                  required
                  className="w-full !border-neutral-300 !bg-neutral-50"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </Field>

              <Field data-invalid={!!error}>
                <FieldLabel htmlFor="password">Password</FieldLabel>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPw ? "text" : "password"}
                    required
                    className="w-full pr-10 !border-neutral-300 !bg-neutral-50"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPw((v) => !v)}
                    aria-label={showPw ? "Hide password" : "Show password"}
                    className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-neutral-500 hover:bg-neutral-200 hover:text-neutral-800"
                  >
                    {showPw ? (
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908A3 3 0 1115 12m6 0a10.05 10.05 0 01-1.876 3.11M6.28 6.28A9.965 9.965 0 0112 5c4.477 0 8.267 2.943 9.542 7a10.008 10.008 0 01-1.902 3.293M3 3l18 18" />
                      </svg>
                    ) : (
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                    )}
                  </button>
                </div>
              </Field>

              {error && <FieldError>{error}</FieldError>}

              <Field>
                <Button type="submit" disabled={loading} className="w-full">
                  {loading ? "Signing in…" : "Sign in"}
                </Button>
              </Field>
            </FieldGroup>
          </form>
        </div>
      </div>
    </div>
  );
}

// Diagram of the 5 composable AI agents (CLAUDE.md §5). Vertical flow:
// natural-language input → orchestration hub → 5 agent pills → outputs.
// Pure SVG + Tailwind, no fabricated numbers, no image asset.
function AiFlowIllustration() {
  const agents: { name: string; role: string; color: string }[] = [
    { name: "Planner", role: "Structures projects & sprints", color: "bg-primary-100 text-primary-700" },
    { name: "Monitor", role: "Watches for risk & drift", color: "bg-info-100 text-info-600" },
    { name: "Analyst", role: "Turns data into insight", color: "bg-success-100 text-success-600" },
    { name: "Writer", role: "Drafts docs & comms", color: "bg-warning-100 text-warning-600" },
    { name: "Communicator", role: "Sends updates & standups", color: "bg-ai-100 text-ai-600" },
  ];

  return (
    <div className="rounded-lg border border-neutral-300 bg-neutral-50/80 p-5 shadow-sm backdrop-blur">
      <p className="text-caption font-semibold uppercase tracking-wider text-neutral-500">How Centr8 works</p>

      {/* Input pill */}
      <div className="mt-4 rounded-md border border-neutral-300 bg-neutral-50 p-3">
        <p className="text-caption text-neutral-500">Your input</p>
        <p className="mt-0.5 truncate font-heading text-small font-medium text-neutral-800">
          &quot;Kick off a Q3 marketing site rebuild.&quot;
        </p>
      </div>

      {/* Connector line down to hub */}
      <div className="mx-auto h-4 w-px bg-neutral-300" />

      {/* Central AI hub */}
      <div className="mx-auto flex w-40 items-center justify-center gap-2 rounded-full border border-ai-600/40 bg-ai-100 px-3 py-1.5">
        <svg className="h-4 w-4 text-ai-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 3l1.9 5.6L19.5 10.5l-5.6 1.9L12 18l-1.9-5.6L4.5 10.5l5.6-1.9L12 3z" />
        </svg>
        <span className="text-small font-semibold text-ai-600">Centr8 AI</span>
      </div>

      {/* Connector line down to agent grid */}
      <div className="mx-auto h-4 w-px bg-neutral-300" />

      {/* 5 agent pills — 2 rows (3 + 2) so they fit the narrow column */}
      <ul className="grid grid-cols-3 gap-2">
        {agents.map((a) => (
          <li key={a.name} className={`rounded-md px-2 py-2 text-center ${a.color}`}>
            <p className="text-caption font-semibold">{a.name}</p>
            <p className="mt-0.5 text-caption leading-tight opacity-80">{a.role}</p>
          </li>
        ))}
      </ul>

      {/* Connector line down to output */}
      <div className="mx-auto mt-2 h-4 w-px bg-neutral-300" />

      {/* Output pill */}
      <div className="flex items-center justify-between rounded-md border border-success-600/40 bg-success-100 px-3 py-2">
        <span className="text-small font-semibold text-success-600">Shipped to team</span>
        <svg className="h-4 w-4 text-success-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        </svg>
      </div>

      <p className="mt-3 text-center text-caption text-neutral-500">
        Every AI action is queued for your approval before it ships.
      </p>
    </div>
  );
}
