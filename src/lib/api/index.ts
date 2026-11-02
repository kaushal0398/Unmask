import type { LaunchApi } from "@/lib/api/types";
import { HttpLaunchApi } from "@/lib/api/http";
import { MockLaunchApi } from "@/lib/api/mock";

let demoInstance: MockLaunchApi | null = null;

export function mockApi(): MockLaunchApi {
  return (demoInstance ??= new MockLaunchApi());
}

export function getApi(sessionToken?: string): LaunchApi {
  return new HttpLaunchApi(sessionToken);
}

export * from "@/lib/api/types";