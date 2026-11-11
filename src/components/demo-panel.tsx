"use client";

import { FastForward, RotateCcw, X } from "lucide-react";
import { useEffect, useState, useSyncExternalStore } from "react";
import { Button, cx } from "@/components/ui";
import { useToast } from "@/components/toast";
import { mockApi } from "@/lib/api";
import { clock } from "@/lib/clock";
import { LAUNCHES } from "@/lib/demo";

/** Shown with the `d` key or `?demo=1`. For presenters: it changes the page's clock and makes the stand-in fail on cue. */
let shown = false;
const listeners = new Set<() => void>();
const set = (v: boolean) => {
  shown = v;
  listeners.forEach((l) => l());
};
const subscribe = (l: () => void) => {
  listeners.add(l);
  if (!shown && typeof location !== "undefined" && new URLSearchParams(location.search).get("demo") === "1") queueMicrotask(() => set(true));
  return () => listeners.delete(l);
};
const useShown = () => useSyncExternalStore(subscribe, () => shown, () => false);

const SPEEDS = [1, 60, 600];

export function DemoPanel() {
  const open = useShown();
  const toast = useToast();
  const speed = useSyncExternalStore(clock.subscribe, () => clock.speed, () => 1);
  const [, force] = useState(0);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
      if (e.key === "d" && !e.metaKey && !e.ctrlKey && !e.altKey) set(!shown);
      if (e.key === "Escape") set(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  if (!open) return null;
  const api = mockApi();
  const act = (label: string, fn: () => void) => () => {
    fn();
    force((n) => n + 1);
    toast(label, "info");
  };
  return (
    <aside aria-label="Demo controls" className="fixed bottom-4 left-4 z-50 w-[min(92vw,20rem)] border border-seal/50 bg-bg p-4 text-sm shadow-[6px_6px_0_0_rgba(229,1,165,0.25)]">
      <div className="flex items-center justify-between">
        <p className="flex items-center gap-2 font-semibold text-seal-fg"><FastForward className="size-4" /> Demo controls</p>
        <button onClick={() => set(false)} aria-label="Close demo controls" className="text-muted hover:text-text"><X className="size-4" /></button>
      </div>
      <p className="mt-3 text-xs uppercase tracking-wider text-faint">Clock speed</p>
      <div className="mt-2 flex gap-2">
        {SPEEDS.map((s) => (
          <button key={s} onClick={() => clock.setSpeed(s)} aria-pressed={speed === s} className={cx("flex-1 border px-2 py-1.5 font-mono text-xs", speed === s ? "border-seal bg-seal/15 text-seal-fg" : "border-line-strong text-muted hover:text-text")}>{s}×</button>
        ))}
      </div>
      <p className="mt-4 text-xs uppercase tracking-wider text-faint">Skip ahead</p>
      <button
        className="mt-2 w-full border border-seal/50 px-3 py-1.5 text-xs text-seal-fg hover:bg-seal/10"
        onClick={() => {
          const t = clock.now();
          const left = LAUNCHES.filter((l) => l.status === "open").map((l) => clock.sessionStart() + (l.closesInMs ?? 0) - t).filter((x) => x > 0);
          if (left.length) clock.skip(Math.min(...left) + 1000);
        }}
      >
        Skip to the close
      </button>
      <div className="mt-2 flex gap-2">
        {[["+15 min", 15 * 60_000], ["+1 hour", 3_600_000], ["+4 hours", 4 * 3_600_000]].map(([label, ms]) => (
          <button key={label} onClick={() => clock.skip(Number(ms))} className="flex-1 border border-line-strong px-2 py-1.5 text-xs text-muted hover:text-text">{label}</button>
        ))}
      </div>
      <p className="mt-4 text-xs uppercase tracking-wider text-faint">Make it fail</p>
      <div className="mt-2 flex flex-col gap-2">
        <button className="border border-line-strong px-3 py-1.5 text-left text-xs text-muted hover:text-text" onClick={act("The next payment check will fail.", () => api.failNextPayment())}>Fail the next payment check</button>
        <button className="border border-line-strong px-3 py-1.5 text-left text-xs text-muted hover:text-text" onClick={act("The next create will stop at step 2.", () => api.failNextCreateAt("mint-supply"))}>Fail the next create at step 2</button>
        <button className="border border-line-strong px-3 py-1.5 text-left text-xs text-muted hover:text-text" onClick={act(api.lastCheckId ? "Your latest payment check expired. Funds are still held." : "Place a bid first; there is no payment check yet.", () => api.lastCheckId && api.expireCheck(api.lastCheckId))}>Expire my latest payment check</button>
      </div>
      <Button tone="ghost" className="mt-4 w-full py-2 text-xs" onClick={() => { clock.reset(); toast("Clock back to real time.", "info"); }}>
        <RotateCcw className="size-3.5" /> Reset the clock
      </Button>
      <p className="mt-3 text-xs text-faint">Press <kbd className="border border-line-strong px-1">d</kbd> to hide.</p>
    </aside>
  );
}
