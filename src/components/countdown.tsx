"use client";

import { cx } from "@/components/ui";
import { useNow, useOpenedAt } from "@/lib/use-now";

/** Time left on a demo launch that closes `closesInMs` after the page was opened. Blank until the browser has the time. */
export function useRemaining(closesInMs: number, closesAt?: string): number | null {
  const now = useNow();
  const opened = useOpenedAt();
  // A real launch has a real deadline: count down to it on the wall clock.
  if (closesAt) return now === null ? null : Math.max(0, new Date(closesAt).getTime() - now);
  return now === null || opened === null ? null : Math.max(0, opened + closesInMs - now);
}

const two = (n: number) => String(n).padStart(2, "0");

export function Countdown({ closesInMs = 0, closesAt, size = "lg", className }: { closesInMs?: number; closesAt?: string; size?: "sm" | "lg"; className?: string }) {
  const left = useRemaining(closesInMs, closesAt);
  const total = left === null ? null : Math.floor(left / 1000);
  const parts = total === null ? ["--", "--", "--"] : [two(Math.floor(total / 3600)), two(Math.floor((total % 3600) / 60)), two(total % 60)];
  const labels = ["hours", "min", "sec"];

  if (size === "sm") {
    return (
      <span className={cx("font-mono text-sm tabular-nums", className)} aria-label="time left">
        {parts.join(":")}
      </span>
    );
  }
  return (
    <div className={cx("flex items-end gap-3 sm:gap-5", className)} role="timer" aria-label="time left until the launch closes">
      {parts.map((p, i) => (
        <div key={labels[i]} className="flex items-end gap-3 sm:gap-5">
          <div>
            <div className="font-mono text-5xl font-medium tabular-nums tracking-tight sm:text-7xl">{p}</div>
            <div className="mt-1 text-xs uppercase tracking-widest text-faint">{labels[i]}</div>
          </div>
          {i < 2 && <div className="pb-6 font-mono text-3xl text-faint sm:pb-8 sm:text-5xl">:</div>}
        </div>
      ))}
    </div>
  );
}
