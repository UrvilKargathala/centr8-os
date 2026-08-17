"use client";

import { createContext, useCallback, useContext, useRef, useState } from "react";

type AiUsageContextValue = {
  callCount: number;
  increment: () => void;
  cache: Map<string, unknown>;
};

const AiUsageContext = createContext<AiUsageContextValue | null>(null);

export function AiUsageProvider({ children }: { children: React.ReactNode }) {
  const [callCount, setCallCount] = useState(0);
  const cacheRef = useRef(new Map<string, unknown>());
  const increment = useCallback(() => setCallCount((c) => c + 1), []);
  return (
    <AiUsageContext.Provider value={{ callCount, increment, cache: cacheRef.current }}>
      {children}
    </AiUsageContext.Provider>
  );
}

export function useAiUsage() {
  const ctx = useContext(AiUsageContext);
  if (!ctx) throw new Error("useAiUsage must be used within AiUsageProvider");
  return ctx;
}
