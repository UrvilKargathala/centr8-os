"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";

// Minimal in-app toast — Settings pages surface "Saved" / error messages
// via this. Not a real queue (only the latest message is shown) since the
// page-scoped Save flows fire one message at a time. A shadcn toast has
// been overkill for every prior "show a small confirmation" case in this
// app; extend this component before reaching for a library.
type Toast = { id: number; message: string; tone: "success" | "error" };
type Ctx = { show: (message: string, tone?: "success" | "error") => void };
const ToastCtx = createContext<Ctx | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toast, setToast] = useState<Toast | null>(null);

  const show = useCallback((message: string, tone: "success" | "error" = "success") => {
    setToast({ id: Date.now(), message, tone });
  }, []);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2400);
    return () => clearTimeout(t);
  }, [toast]);

  return (
    <ToastCtx.Provider value={{ show }}>
      {children}
      {toast && (
        <div
          role="status"
          className={`fixed bottom-6 left-1/2 z-[60] -translate-x-1/2 rounded-md px-4 py-2 text-body-medium font-medium shadow-lg ${
            toast.tone === "success"
              ? "bg-success-600 text-neutral-50"
              : "bg-danger-600 text-neutral-50"
          }`}
        >
          {toast.message}
        </div>
      )}
    </ToastCtx.Provider>
  );
}

export function useToast(): Ctx {
  const ctx = useContext(ToastCtx);
  if (!ctx) return { show: () => {} };
  return ctx;
}
