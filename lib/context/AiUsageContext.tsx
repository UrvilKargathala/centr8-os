"use client";

import { createContext, useCallback, useContext, useState } from "react";

type AiUsageContextValue = {
  callCount: number;
  increment: () => void;
  cache: Map<string, unknown>;
};

const AiUsageContext = createContext<AiUsageContextValue | null>(null);

export function AiUsageProvider({ children }: { children: React.ReactNode }) {
  const [callCount, setCallCount] = useState(0);
  // Stable identity across renders (never re-set, only mutated by callers
  // for a plain in-memory cache) without reading a ref during render —
  // useState's lazy initializer gives the same one-time-construction
  // guarantee useRef did, but as a render-safe value instead of a ref.
  const [cache] = useState(() => new Map<string, unknown>());
  const increment = useCallback(() => setCallCount((c) => c + 1), []);
  return (
    <AiUsageContext.Provider value={{ callCount, increment, cache }}>
      {children}
    </AiUsageContext.Provider>
  );
}

export function useAiUsage() {
  const ctx = useContext(AiUsageContext);
  if (!ctx) throw new Error("useAiUsage must be used within AiUsageProvider");
  return ctx;
}
