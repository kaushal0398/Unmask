
import {
  ApiError,
  type Launch,
  type LaunchApi,
  type PaymentCheck,
  type SealedBid,
} from "@/lib/api/types";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:4001";

type BackendLaunch = {
  id: string;
  name: string;
  symbol: string;
  creator: string;
  emoji: string;
  hue: number;
  tagline: string;
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

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;

  try {
    response = await fetch(`${API_BASE}${path}`, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        ...init?.headers,
      },
      cache: "no-store",
    });
  } catch {
    throw new ApiError("network", "Could not reach the Snipe-Proof backend.");
  }

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const error = data?.error;
    const code = error?.code === "not_found"
      ? "not_found"
      : error?.code === "closed"
        ? "closed"
        : error?.code === "payment_failed"
          ? "payment_failed"
          : "bid_rejected";

    throw new ApiError(code, error?.message ?? "Backend request failed.");
  }

  return data as T;
}

function fromAtomic(value: string, decimals: number): number {
  return Number(value) / 10 ** decimals;
}

function toAtomic(value: number, decimals: number): string {
  if (!Number.isFinite(value) || value <= 0) {
    throw new ApiError("bid_rejected", "Amount must be a positive number.");
  }

  const scale = 10 ** decimals;
  const atomic = Math.round(value * scale);

  if (!Number.isSafeInteger(atomic)) {
    throw new ApiError("bid_rejected", "Amount exceeds safe frontend precision.");
  }

  return String(atomic);
}

function mapLaunch(item: BackendLaunch): Launch {
  const status = item.status === "closed" ? "sealed" : item.status;

  if (status !== "open" && status !== "sealed" && status !== "settled") {
    throw new ApiError("network", `Unsupported launch status: ${status}`);
  }

  return {
    id: item.id,
    name: item.name,
    symbol: item.symbol,
    creator: item.creator,
    emoji: item.emoji,
    hue: item.hue,
    tagline: item.tagline,
    supply: fromAtomic(item.supplyAtomic, item.tokenDecimals),
    reserve: fromAtomic(item.reserveAtomic, item.paymentDecimals),
    cap: item.capBps === null ? null : item.capBps / 10_000,
    status,
    ...(item.closesAt ? { closesAt: item.closesAt } : {}),
    bidCount: item.bidCount,
    tokenContract: item.tokenContract ?? "",
    codeHash: item.codeHash ?? "",
  };
}

export class HttpLaunchApi implements LaunchApi {
  async listLaunches(): Promise<Launch[]> {
    const data = await request<{ launches: BackendLaunch[] }>("/v1/launches");
    return data.launches.map(mapLaunch);
  }

  async getLaunch(id: string): Promise<Launch | null> {
    try {
      const data = await request<{ launch: BackendLaunch }>(
        `/v1/launches/${encodeURIComponent(id)}`,
      );
      return mapLaunch(data.launch);
    } catch (error) {
      if (error instanceof ApiError && error.code === "not_found") return null;
      throw error;
    }
  }

  async createPaymentCheck(input: { launchId: string; amount: number }) {
    const launch = await this.getLaunch(input.launchId);
    if (!launch) throw new ApiError("not_found", "Launch not found.");

    const payment = await request<{
      check: {
        id: string;
        token: string;
        amountAtomic: string;
        state: string;
        expiresAt: string;
      };
      claimKey: string;
      warning?: string;
    }>(`/v1/launches/${encodeURIComponent(input.launchId)}/payment-checks`, {
      method: "POST",
      body: JSON.stringify({
        bidder: "demo.near",
        token: "usdc",
        amountAtomic: toAtomic(input.amount, 6),
      }),
    });

    const check: PaymentCheck = {
      id: payment.check.id,
      token: payment.check.token,
      amount: fromAtomic(payment.check.amountAtomic, 6),
      state: payment.check.state as PaymentCheck["state"],
      expiresAt: payment.check.expiresAt,
    };

    return { check, key: payment.claimKey };
  }

  async getPaymentCheck(id: string): Promise<PaymentCheck | null> {
    try {
      const data = await request<{
        check: {
          id: string;
          token: string;
          amountAtomic: string;
          state: string;
          expiresAt: string;
        };
      }>(`/v1/payment-checks/${encodeURIComponent(id)}`);

      return {
        id: data.check.id,
        token: data.check.token,
        amount: fromAtomic(data.check.amountAtomic, 6),
        state: data.check.state as PaymentCheck["state"],
        expiresAt: data.check.expiresAt,
      };
    } catch (error) {
      if (error instanceof ApiError && error.code === "not_found") return null;
      throw error;
    }
  }

  async reclaimPaymentCheck(id: string): Promise<PaymentCheck> {
    const data = await request<{ check: { id: string; state: string } }>(
      `/v1/payment-checks/${encodeURIComponent(id)}/reclaim`,
      { method: "POST" },
    );

    const existing = await this.getPaymentCheck(id);
    if (!existing) throw new ApiError("not_found", "Payment check not found.");

    return { ...existing, state: data.check.state as PaymentCheck["state"] };
  }

  async submitBid(bid: SealedBid): Promise<{ receiptId: string }> {
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
    );
  }

  async getResult(): Promise<null> {
    throw new ApiError("network", "Settlement results are not implemented by the backend yet.");
  }

  async getEnclaveKey(): Promise<never> {
    throw new ApiError("network", "Live enclave keys are not implemented yet.");
  }

  async withdrawBid(): Promise<void> {
    throw new ApiError("network", "Bid withdrawal is not implemented by the backend yet.");
  }

  async createLaunch(): Promise<never> {
    throw new ApiError("network", "Launch creation adapter is not implemented yet.");
  }

  async positions(): Promise<never> {
    throw new ApiError("network", "Position history is not implemented by the backend yet.");
  }
}
