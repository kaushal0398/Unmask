"use client";

import { AlertTriangle, Check, X } from "lucide-react";
import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from "react";
import { cx } from "@/components/ui";

type Tone = "ok" | "error" | "info";
type Toast = { id: number; tone: Tone; text: string };
type Api = { toast: (text: string, tone?: Tone) => void };

const Ctx = createContext<Api>({ toast: () => {} });

/** Short messages in the corner. Errors stay longer and are announced to screen readers. */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<Toast[]>([]);
  const seq = useRef(0);
  const dismiss = useCallback((id: number) => setItems((xs) => xs.filter((x) => x.id !== id)), []);
  const toast = useCallback(
    (text: string, tone: Tone = "info") => {
      const id = ++seq.current;
      setItems((xs) => [...xs.slice(-3), { id, tone, text }]);
      setTimeout(() => dismiss(id), tone === "error" ? 9000 : 4500);
    },
    [dismiss],
  );
  const value = useMemo(() => ({ toast }), [toast]);

  return (
    <Ctx.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed inset-x-4 bottom-4 z-50 flex flex-col items-end gap-2 sm:inset-x-auto sm:right-6 sm:bottom-6" aria-live="polite">
        {items.map((t) => (
          <div
            key={t.id}
            role={t.tone === "error" ? "alert" : "status"}
            className={cx(
              "pointer-events-auto flex w-full max-w-sm items-start gap-3 border bg-black p-4 text-sm shadow-[4px_4px_0_0_rgba(255,255,255,0.08)] sm:w-auto",
              t.tone === "error" ? "border-danger/60" : t.tone === "ok" ? "border-verified/60" : "border-line-strong",
            )}
          >
            {t.tone === "error" ? <AlertTriangle className="mt-0.5 size-4 shrink-0 text-danger" /> : t.tone === "ok" ? <Check className="mt-0.5 size-4 shrink-0 text-verified" /> : null}
            <span className="flex-1 leading-relaxed">{t.text}</span>
            <button onClick={() => dismiss(t.id)} aria-label="Dismiss" className="text-muted hover:text-text"><X className="size-4" /></button>
          </div>
        ))}
      </div>
    </Ctx.Provider>
  );
}

export const useToast = () => useContext(Ctx).toast;
