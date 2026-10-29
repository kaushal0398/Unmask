"use client";

import { useSyncExternalStore } from "react";

const subscribe = (notify: () => void) => {
  const id = setInterval(notify, 1000);
  return () => clearInterval(id);
};

/** The current time in whole seconds, or `null` on the server and on the first client render (so nothing mismatches). */
export function useNow(): number | null {
  return useSyncExternalStore(subscribe, () => Math.floor(Date.now() / 1000) * 1000, () => null);
}

let started: number | null = null;
const never = () => () => {};

/**
 * When this page was opened, so a demo launch can close "in 14 minutes" from now. `null` until the browser has it.
 * Time-dependent values must come from the client: the pages are prerendered.
 */
export function useOpenedAt(): number | null {
  return useSyncExternalStore(never, () => (started ??= Date.now()), () => null);
}
