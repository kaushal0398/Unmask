"use client";

import { useSyncExternalStore } from "react";
import { clock } from "@/lib/clock";

const subscribe = (notify: () => void) => {
  const id = setInterval(notify, 250);
  const off = clock.subscribe(notify);
  return () => {
    clearInterval(id);
    off();
  };
};

/** The page's time in whole seconds, or `null` on the server and on the first client render (so nothing mismatches). */
export function useNow(): number | null {
  return useSyncExternalStore(subscribe, () => Math.floor(clock.now() / 1000) * 1000, () => null);
}

const never = () => () => {};

/**
 * When this page was opened, on the page's clock, so a demo launch can close "in 14 minutes" from now. `null` until
 * the browser has it. Time-dependent values must come from the client: the pages are prerendered.
 */
export function useOpenedAt(): number | null {
  return useSyncExternalStore(never, () => clock.sessionStart(), () => null);
}
