import type { LaunchApi } from "@/lib/api/types";
import { MockLaunchApi } from "@/lib/api/mock";

/**
 * The one place that decides what is behind the interface. Today it is the mock; when the core exists, return a
 * client for it here and no screen changes. The instance is per browser tab (and per server process), which is what
 * lets the mock remember a bid between pages.
 */
let instance: MockLaunchApi | null = null;

export function mockApi(): MockLaunchApi {
  return (instance ??= new MockLaunchApi());
}

export function getApi(): LaunchApi {
  return mockApi();
}

export * from "@/lib/api/types";
