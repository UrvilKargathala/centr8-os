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
    router.push(searchParams.get("next") || "/dashboard");
    router.refresh();
  }

  return (
    <div className="flex min-h-screen bg-neutral-50">
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

          <ul className="space-y-4">
            {[
              {
                title: "An AI project manager on the team",
                sub: "Plans sprints, monitors risk, and drafts client updates — you approve the ones that ship.",
                icon: "M12 3l1.9 5.6L19.5 10.5l-5.6 1.9L12 18l-1.9-5.6L4.5 10.5l5.6-1.9L12 3z",
              },
              {
                title: "Projects, HR, and CRM in one place",
                sub: "One source of truth for people, deals, and delivery — no more switching tabs to find context.",
                icon: "M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z",
              },
              {
                title: "Ship your first sprint in 15 minutes",
                sub: "Templates, AI-drafted plans, and instant setup — you're running work the same day you sign in.",
                icon: "M13 10V3L4 14h7v7l9-11h-7z",
              },
            ].map((f) => (
              <li key={f.title} className="flex items-start gap-3 rounded-md border border-neutral-300 bg-neutral-50/80 p-4 shadow-sm backdrop-blur">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-primary-100 text-primary-700">
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d={f.icon} />
                  </svg>
                </span>
                <div className="min-w-0">
                  <p className="text-body-medium font-semibold text-neutral-950">{f.title}</p>
                  <p className="mt-0.5 text-small text-neutral-600">{f.sub}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Form side */}
      <div className="flex w-full items-center justify-center px-6 py-12 md:w-1/2">
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
                  className="w-full"
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
                    className="w-full pr-10"
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
