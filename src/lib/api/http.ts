
import {
  ApiError,
  CreateStepError,
  type CreateLaunchInput,
  type CreateStep,
  type Launch,
  type LaunchApi,
} from "@/lib/api/types";
import { MockLaunchApi } from "@/lib/api/mock";

const BASE_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:4001";

// Development placeholder only. This is NOT a deployed NEP-141 token.
const PAYMENT_TOKEN =
  process.env.NEXT_PUBLIC_TEST_PAYMENT_TOKEN ?? "test-token.testnet";

const TOKEN_DECIMALS = 0;
const PAYMENT_DECIMALS = 6;

type BackendLaunch = {
  id: string;
  name: string;
  symbol: string;
  creator: string;
  emoji?: string;
  hue?: number;
  tagline?: string;
  supplyAtomic: string;
  reserveAtomic: string;
  tokenDecimals: number;
  paymentToken: string;
  paymentDecimals: number;
  capBps: number | null;
  status: string;
  closesAt: string | null;
  bidCount: number;
  tokenContract: string | null;
  codeHash: string | null;
};

function units(atomic: string, decimals: number): number {
  return Number(atomic) / 10 ** decimals;
}

function mapLaunch(item: BackendLaunch): Launch {
  const status =
    item.status === "closed"
      ? "sealed"
      : item.status === "settled" || item.status === "cancelled"
        ? "settled"
        : "open";

  return {
    id: item.id,
    name: item.name,
    symbol: item.symbol,
    emoji: item.emoji ?? "🪙",
    hue: item.hue ?? 145,
    tagline: item.tagline ?? "A development launch.",
    creator: item.creator,
    supply: units(item.supplyAtomic, item.tokenDecimals),
    reserve: units(item.reserveAtomic, item.paymentDecimals),
    cap: item.capBps === null ? null : item.capBps / 10_000,
    status,
    ...(item.closesAt ? { closesAt: item.closesAt } : {}),
    bidCount: item.bidCount,
    tokenContract: item.tokenContract ?? "",
    codeHash: item.codeHash ?? "",
  };
}

async function request<T>(
  path: string,
  options: RequestInit = {},
  token?: string,
): Promise<T> {
  let response: Response;

  try {
    response = await fetch(`${BASE_URL}${path}`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...options.headers,
      },
      cache: "no-store",
    });
  } catch {
    throw new ApiError("network", "Could not connect to the backend.");
  }

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    const message =
      data?.error?.message ?? `Backend request failed (${response.status}).`;

    if (response.status === 404) {
      throw new ApiError("not_found", message);
    }

    if (response.status === 409) {
      throw new ApiError("closed", message);
    }

    throw new ApiError("network", message);
  }

  return data as T;
}

export class HttpLaunchApi implements LaunchApi {
  private readonly demo = new MockLaunchApi();

  constructor(private readonly sessionToken?: string) {}

  async listLaunches(): Promise<Launch[]> {
    const [demoLaunches, response] = await Promise.all([
      this.demo.listLaunches(),
      request<{ launches: BackendLaunch[] }>("/v1/launches"),
    ]);

    const backendLaunches = response.launches.map(mapLaunch);
    const existingIds = new Set(backendLaunches.map((launch) => launch.id));

    return [
      ...backendLaunches,
      ...demoLaunches.filter((launch) => !existingIds.has(launch.id)),
    ];
  }

  async getLaunch(id: string): Promise<Launch | null> {
    try {
      const response = await request<{ launch: BackendLaunch }>(
        `/v1/launches/${encodeURIComponent(id)}`,
      );
      return mapLaunch(response.launch);
    } catch (error) {
      if (error instanceof ApiError && error.code === "not_found") {
        return this.demo.getLaunch(id);
      }
      throw error;
    }
  }

  async createLaunch(
    input: CreateLaunchInput,
    onStep: (steps: CreateStep[]) => void,
  ): Promise<{ id: string }> {
    if (!this.sessionToken) {
      throw new ApiError(
        "network",
        "Connect your real NEAR wallet before creating a launch.",
      );
    }

    const step: CreateStep = {
      id: "register-launch",
      label: "Saving launch configuration to the backend",
      state: "running",
    };

    onStep([{ ...step }]);

    try {
      const tokenAtomic = BigInt(
        Math.round(input.supply * 10 ** TOKEN_DECIMALS),
      ).toString();

      const reserveAtomic = BigInt(
        Math.round(input.reserve * 10 ** PAYMENT_DECIMALS),
      ).toString();

      const opensAt = new Date();
      const closesAt = new Date(
        opensAt.getTime() + input.windowMinutes * 60_000,
      );

      const response = await request<{ launch: BackendLaunch }>(
        "/v1/launches",
        {
          method: "POST",
          body: JSON.stringify({
            name: input.name.trim(),
            symbol: input.symbol.toUpperCase(),
            creator: "placeholder.near",
            supplyAtomic: tokenAtomic,
            reserveAtomic,
            tokenDecimals: TOKEN_DECIMALS,
            paymentToken: PAYMENT_TOKEN,
            paymentDecimals: PAYMENT_DECIMALS,
            capBps:
              input.capPercent > 0 ? input.capPercent * 100 : null,
            opensAt: opensAt.toISOString(),
            closesAt: closesAt.toISOString(),
          }),
        },
        this.sessionToken,
      );

      step.state = "done";
      onStep([{ ...step }]);

      return { id: response.launch.id };
    } catch (error) {
      step.state = "failed";
      step.error =
        error instanceof Error ? error.message : "Launch creation failed.";

      onStep([{ ...step }]);

      throw new CreateStepError("register-launch", step.error);
    }
  }

  getResult(id: string) {
    return this.demo.getResult(id);
  }

  getEnclaveKey(id: string) {
    return this.demo.getEnclaveKey(id);
  }

  createPaymentCheck(input: { launchId: string; amount: number }) {
    return this.demo.createPaymentCheck(input);
  }

  getPaymentCheck(id: string) {
    return this.demo.getPaymentCheck(id);
  }

  reclaimPaymentCheck(id: string) {
    return this.demo.reclaimPaymentCheck(id);
  }

  submitBid(bid: Parameters<LaunchApi["submitBid"]>[0]) {
    return this.demo.submitBid(bid);
  }

  withdrawBid(launchId: string, bidder: string) {
    return this.demo.withdrawBid(launchId, bidder);
  }

  positions(account: string) {
    return this.demo.positions();
  }
}
