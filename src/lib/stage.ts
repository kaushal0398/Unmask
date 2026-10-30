import type { LaunchStatus } from "@/lib/api/types";

/** How long the demo enclave "takes" to settle a launch that has just closed, in the page's time. */
export const SETTLE_MS = 20_000;
export const SETTLE_STEPS = 5;

export type Stage =
  | { kind: "open"; remainingMs: number }
  | { kind: "settling"; step: number; elapsedMs: number }
  | { kind: "settled" };

/**
 * Where a launch is right now. A launch that is already settled, or already closed and counting, stays that way.
 * One that is open closes when its time runs out, then settles in steps: so a demo can run a whole launch live.
 */
export function stageOf(a: { status: LaunchStatus; closesInMs?: number; openedAt: number; now: number }): Stage {
  if (a.status === "settled") return { kind: "settled" };
  if (a.status === "sealed") return { kind: "settling", step: 2, elapsedMs: 0 };
  const closesAt = a.openedAt + (a.closesInMs ?? 0);
  if (a.now < closesAt) return { kind: "open", remainingMs: closesAt - a.now };
  const elapsed = a.now - closesAt;
  if (elapsed >= SETTLE_MS) return { kind: "settled" };
  return { kind: "settling", step: Math.min(SETTLE_STEPS - 1, Math.floor((elapsed / SETTLE_MS) * SETTLE_STEPS)), elapsedMs: elapsed };
}
