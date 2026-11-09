
import {
  ApiError,
  CreateStepError,
  type Allocation,
  type CreateLaunchInput,
  type EnclaveKey,
  type Result,
  type CreateStep,
  type Launch,
  type LaunchApi,
  type PaymentCheck,
  type MyBid,
  type ReceiptVerification,
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

type BackendResult = {
  launchId: string;
  clearingPrice: string;
  sold: string;
  totalRaised: string;
  outcome: {
    unsold: string;
    fills: Array<{ bidder: string; limitPrice: string; requested: string; filled: string; payment: string; refund: string }>;
  };
  inputHash: string;
  codeHash: string;
  attestation: string | null;
  skippedBids: number;
  settledAt: string;
};

type BackendPaymentCheck = {
  id: string;
  token: string;
  amountAtomic: string;
  state: string;
  expiresAt: string;
};

type BackendMyBid = {
  id: string;
  launchId: string;
  bidder: string;
  commitment: string;
  paymentCheckId: string;
  keyId: string;
  receiptId: string;
  createdAt: string;

  launch: {
    id: string;
    name: string;
    symbol: string;
    emoji: string;
    hue: number;
    state: string;
    closesAt: string | null;
  };

  paymentCheck: {
    token: string;
    amountAtomic: string;
    state: string;
    expiresAt: string;
  };
};

function units(atomic: string, decimals: number): number {
  return Number(atomic) / 10 ** decimals;
}

function paymentToAtomic(amount: number): string {
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new ApiError("payment_failed", "Payment amount must be positive.");
  }

  return BigInt(
    Math.round(amount * 10 ** PAYMENT_DECIMALS),
  ).toString();
}

function mapPaymentCheck(item: BackendPaymentCheck): PaymentCheck {
  const states = [
    "creating",
    "locked",
    "failed",
    "expired",
    "reclaimed",
    "claimed",
  ] as const;

  const normalizedState = item.state.toLowerCase();

  const state = states.includes(
    normalizedState as (typeof states)[number],
  )
    ? (normalizedState as (typeof states)[number])
    : "failed";

  return {
    id: item.id,
    token: item.token,
    amount: units(item.amountAtomic, PAYMENT_DECIMALS),
    state,
    expiresAt: item.expiresAt,
  };
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
      data?.error?.message ??
      `Backend request failed (${response.status}).`;

    if (response.status === 404) {
      throw new ApiError("not_found", message);
    }

    if (response.status === 409) {
      if (data?.error?.code === "duplicate_bid") {
        throw new ApiError("duplicate_bid", message);
      }

      throw new ApiError("closed", message);
    }

    if (response.status === 401 || response.status === 403) {
      throw new ApiError(
        "network",
        "Your wallet session is invalid or expired. Please reconnect and authenticate.",
      );
    }

    throw new ApiError("network", message);
  }

  return data as T;
}

export class HttpLaunchApi implements LaunchApi {
  private readonly demo = new MockLaunchApi();

  constructor(private readonly sessionToken?: string) {}

  private requireSession(): string {
    if (!this.sessionToken) {
      throw new ApiError(
        "network",
        "Connect and authenticate your real NEAR wallet first.",
      );
    }

    return this.sessionToken;
  }

  async listLaunches(): Promise<Launch[]> {
    const [demoLaunches, response] = await Promise.all([
      this.demo.listLaunches(),
      request<{ launches: BackendLaunch[] }>("/v1/launches"),
    ]);

    const backendLaunches = response.launches.map(mapLaunch);
    const existingIds = new Set(
      backendLaunches.map((launch) => launch.id),
    );

    return [
      ...backendLaunches,
      ...demoLaunches.filter(
        (launch) => !existingIds.has(launch.id),
      ),
    ];
  }

  async getLaunch(id: string): Promise<Launch | null> {
    try {
      const response = await request<{ launch: BackendLaunch }>(
        `/v1/launches/${encodeURIComponent(id)}`,
      );

      return mapLaunch(response.launch);
    } catch (error) {
      if (
        error instanceof ApiError &&
        error.code === "not_found"
      ) {
        return this.demo.getLaunch(id);
      }

      throw error;
    }
  }

  async createLaunch(
    input: CreateLaunchInput,
    onStep: (steps: CreateStep[]) => void,
  ): Promise<{ id: string }> {
    const token = this.requireSession();

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
              input.capPercent > 0
                ? input.capPercent * 100
                : null,
            opensAt: opensAt.toISOString(),
            closesAt: closesAt.toISOString(),
          }),
        },
        token,
      );

      step.state = "done";
      onStep([{ ...step }]);

      return { id: response.launch.id };
    } catch (error) {
      step.state = "failed";
      step.error =
        error instanceof Error
          ? error.message
          : "Launch creation failed.";

      onStep([{ ...step }]);

      throw new CreateStepError("register-launch", step.error);
    }
  }

  async getResult(id: string): Promise<Result | null> {
    let response: { result: BackendResult };
    try {
      response = await request<{ result: BackendResult }>(`/v1/launches/${encodeURIComponent(id)}/result`);
    } catch (error) {
      if (error instanceof ApiError && error.code === "not_found") return null;
      throw error;
    }
    const r = response.result;
    const unit = (value: string, decimals: number) => Number(value) / 10 ** decimals;
    const allocations: Allocation[] = r.outcome.fills.map((f) => ({
      bidder: f.bidder,
      limit: unit(f.limitPrice, PAYMENT_DECIMALS),
      qty: unit(f.requested, TOKEN_DECIMALS),
      filled: unit(f.filled, TOKEN_DECIMALS),
      paid: unit(f.payment, PAYMENT_DECIMALS),
      refund: unit(f.refund, PAYMENT_DECIMALS),
    }));
    const resultHash = Array.from(
      new Uint8Array(await globalThis.crypto.subtle.digest("SHA-256", new TextEncoder().encode(JSON.stringify(r.outcome)))),
      (b) => b.toString(16).padStart(2, "0"),
    ).join("");
    return {
      launchId: r.launchId,
      clearingPrice: unit(r.clearingPrice, PAYMENT_DECIMALS),
      sold: unit(r.sold, TOKEN_DECIMALS),
      unsold: unit(r.outcome.unsold, TOKEN_DECIMALS),
      raised: unit(r.totalRaised, PAYMENT_DECIMALS),
      allocations,
      totalBids: allocations.length + r.skippedBids,
      codeHash: r.codeHash,
      inputHash: r.inputHash,
      attestation: { kind: r.attestation ? "tdx" : "dev", quote: r.attestation ?? "", codeHash: r.codeHash, inputHash: r.inputHash, resultHash, signer: "dev-enclave" },
      settledAt: r.settledAt,
    };
  }

  /** The key a bid is sealed to. Never falls back to a demo key: a bid sealed to it could not be opened. */
  async getEnclaveKey(id: string): Promise<EnclaveKey> {
    const response = await request<{ key: EnclaveKey }>(`/v1/launches/${encodeURIComponent(id)}/enclave-key`);
    return response.key;
  }

  async createPaymentCheck(input: {
    launchId: string;
    bidder: string;
    amount: number;
  }): Promise<{ check: PaymentCheck; key: string }> {
    const token = this.requireSession();

    const response = await request<{
      check: BackendPaymentCheck;
      claimKey: string;
      warning?: string;
    }>(
      `/v1/launches/${encodeURIComponent(input.launchId)}/payment-checks`,
      {
        method: "POST",
        body: JSON.stringify({
          bidder: input.bidder,
          token: PAYMENT_TOKEN,
          amountAtomic: paymentToAtomic(input.amount),
        }),
      },
      token,
    );

    return {
      check: mapPaymentCheck(response.check),
      key: response.claimKey,
    };
  }

  async getPaymentCheck(id: string): Promise<PaymentCheck | null> {
    const token = this.requireSession();

    try {
      const response = await request<{
        check: BackendPaymentCheck;
      }>(
        `/v1/payment-checks/${encodeURIComponent(id)}`,
        {},
        token,
      );

      return mapPaymentCheck(response.check);
    } catch (error) {
      if (
        error instanceof ApiError &&
        error.code === "not_found"
      ) {
        return null;
      }

      throw error;
    }
  }

  async reclaimPaymentCheck(id: string): Promise<PaymentCheck> {
    const token = this.requireSession();

    const response = await request<{
      check: BackendPaymentCheck;
    }>(
      `/v1/payment-checks/${encodeURIComponent(id)}/reclaim`,
      {
        method: "POST",
      },
      token,
    );

    return mapPaymentCheck(response.check);
  }

  async submitBid(
    bid: Parameters<LaunchApi["submitBid"]>[0],
  ): Promise<{ receiptId: string }> {
    const token = this.requireSession();

    return request<{ receiptId: string }>(
      `/v1/launches/${encodeURIComponent(bid.launchId)}/bids`,
      {
        method: "POST",
        body: JSON.stringify({
          bidder: bid.bidder,
          ciphertext: bid.ciphertext,
          commitment: bid.commitment,
          paymentCheckId: bid.paymentCheckId,
          keyId: bid.keyId,
        }),
      },
      token,
    );
  }

  async getMyBids(): Promise<MyBid[]> {
    const token = this.requireSession();

    const response = await request<{
      bids: BackendMyBid[];
    }>("/v1/me/bids", {}, token);

    return response.bids.map((bid) => {
      const states = [
        "creating",
        "locked",
        "failed",
        "expired",
        "reclaimed",
        "claimed",
      ] as const;

      const normalizedState = bid.paymentCheck.state.toLowerCase();

      const paymentState = states.includes(
        normalizedState as (typeof states)[number]
      )
        ? (normalizedState as (typeof states)[number])
        : "failed";

      return {
        id: bid.id,
        launchId: bid.launchId,
        bidder: bid.bidder,
        commitment: bid.commitment,
        paymentCheckId: bid.paymentCheckId,
        keyId: bid.keyId,
        receiptId: bid.receiptId,
        createdAt: bid.createdAt,
        launch: bid.launch,
        paymentCheck: {
          token: bid.paymentCheck.token,
          amount: units(
            bid.paymentCheck.amountAtomic,
            PAYMENT_DECIMALS
          ),
          state: paymentState,
          expiresAt: bid.paymentCheck.expiresAt,
        },
      };
    });
  }

  async verifyReceipt(receiptId: string): Promise<ReceiptVerification> {
    const token = this.requireSession();

    return request<ReceiptVerification>(
      `/v1/receipts/${encodeURIComponent(receiptId)}/verify`,
      {},
      token,
    );
  }

  withdrawBid(launchId: string, bidder: string) {
    return this.demo.withdrawBid(launchId, bidder);
  }

  positions(account: string) {
    return this.demo.positions();
  }
}
