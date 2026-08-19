"use client";

// Shared AI-touchpoint building blocks — pulled out of NewProjectWizard.tsx
// so every AI-assisted form (project wizard, HR employee/onboarding
// screens) uses the same provisional-banner + Accept/Reject/Edit pattern
// (DESIGN_SYSTEM.md §5) instead of re-implementing it per screen.
import { useEffect, useRef, useState, type ReactNode } from "react";
import lottie from "lottie-web/build/player/lottie_light";
import { Button } from "@/components/ui/Button";
import { AiBanner } from "@/components/ui/AiBanner";
import { generateAI } from "@/lib/ai/generate";
import type { mockResponses } from "@/lib/ai/mockResponses";

import aiAnimationData from "@/public/ai-animation.json";

function AiLottie({ className }: { className?: string }) {
  const container = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!container.current) return;
    const anim = lottie.loadAnimation({
      container: container.current,
      animationData: aiAnimationData,
      renderer: "svg",
      loop: true,
      autoplay: true,
    });
    return () => anim.destroy();
  }, []);
  return <div ref={container} className={className} />;
}

export function AiIcon() {
  return (
    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 2l1.7 4.6L18 8.3l-4.3 1.7L12 14.6l-1.7-4.6L6 8.3l4.3-1.7L12 2zm7 12l.9 2.4 2.4.9-2.4.9-.9 2.4-.9-2.4-2.4-.9 2.4-.9.9-2.4z" />
    </svg>
  );
}

export function AiButton({ label, onClick, loading }: { label: string; onClick: () => void; loading: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={loading}
      className="inline-flex items-center gap-1.5 rounded-md border border-ai-600 px-2.5 py-1 text-small font-medium text-ai-600 hover:bg-ai-100 disabled:opacity-60"
    >
      {loading ? (
        <AiLottie className="h-5 w-5" />
      ) : (
        <AiIcon />
      )}
      <span>{loading ? "Thinking…" : label}</span>
    </button>
  );
}

// Generic inline suggestion card. Renders provisional banner + preview
// (children) + Accept / Reject / Edit. Simple value flows pass no onEdit.
export function AiSuggestionCard({
  reasoning,
  onAccept,
  onReject,
  onEdit,
  children,
}: {
  reasoning?: string;
  onAccept: () => void;
  onReject: () => void;
  onEdit?: () => void;
  children: ReactNode;
}) {
  return (
    <div className="mt-2 space-y-2 overflow-hidden rounded-md border border-ai-600/40 glass-purple">
      <AiBanner />
      <div className="space-y-2 px-4 pb-3">
        {children}
        {reasoning && <p className="text-small text-neutral-600">{reasoning}</p>}
        <div className="flex gap-2 pt-1">
          <Button type="button" onClick={onAccept}>
            Accept
          </Button>
          {onEdit && (
            <Button type="button" variant="secondary" onClick={onEdit}>
              Edit
            </Button>
          )}
          <Button type="button" variant="secondary" onClick={onReject}>
            Reject
          </Button>
        </div>
      </div>
    </div>
  );
}

export type AiAgent = keyof typeof mockResponses;

// Small hook to manage a per-touchpoint AI call — loading, result, error.
export function useAiCall<T>(agent: AiAgent, task: string) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<T | null>(null);

  async function run(ctx: Record<string, unknown>) {
    setLoading(true);
    setResult(null);
    try {
      const r = (await generateAI(agent, task, ctx)) as T;
      setResult(r);
    } finally {
      setLoading(false);
    }
  }
  return { loading, result, setResult, run };
}
