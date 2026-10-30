"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Button } from "@/components/ui";

export type ConfirmOptions = { title: string; body: ReactNode; confirm: string; cancel?: string; tone?: "seal" | "danger" };
type Pending = ConfirmOptions & { resolve: (ok: boolean) => void };
const Ctx = createContext<(o: ConfirmOptions) => Promise<boolean>>(() => Promise.resolve(true));

/** Asks before anything that moves money or cannot be undone. Built on the native <dialog>, so focus and Esc just work. */
export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [pending, setPending] = useState<Pending | null>(null);
  const ref = useRef<HTMLDialogElement>(null);
  const ask = useCallback((o: ConfirmOptions) => new Promise<boolean>((resolve) => setPending({ ...o, resolve })), []);
  const value = useMemo(() => ask, [ask]);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (pending && !d.open) d.showModal();
    if (!pending && d.open) d.close();
  }, [pending]);

  const settle = (ok: boolean) => {
    pending?.resolve(ok);
    setPending(null);
  };

  return (
    <Ctx.Provider value={value}>
      {children}
      <dialog
        ref={ref}
        onCancel={(e) => {
          e.preventDefault();
          settle(false);
        }}
        aria-labelledby="confirm-title"
        className="m-auto w-[min(92vw,26rem)] border border-line-strong bg-black p-6 text-text shadow-[6px_6px_0_0_rgba(139,123,255,0.25)] backdrop:bg-black/70"
      >
        {pending && (
          <>
            <h2 id="confirm-title" className="text-lg font-semibold tracking-tight">{pending.title}</h2>
            <div className="mt-3 text-sm leading-relaxed text-muted">{pending.body}</div>
            <div className="mt-6 flex justify-end gap-2">
              <Button tone="ghost" onClick={() => settle(false)} autoFocus>{pending.cancel ?? "Cancel"}</Button>
              <Button tone={pending.tone === "danger" ? "ghost" : "seal"} className={pending.tone === "danger" ? "border-danger/60 text-danger" : undefined} onClick={() => settle(true)}>{pending.confirm}</Button>
            </div>
          </>
        )}
      </dialog>
    </Ctx.Provider>
  );
}

export const useConfirm = () => useContext(Ctx);
