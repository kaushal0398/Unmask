/**
 * NEAR Intents 1Click: fund a bid from another chain.
 *
 * Field names and enums come from the official OpenAPI spec (https://1click.chaindefuser.com/docs/v0/openapi.yaml)
 * and the fixture in ./fixtures is a real dry-run response. The browser never talks to 1Click directly: it calls
 * our backend (`/v1/intents/*`), which holds the optional API token and refuses live (non-dry) quotes unless the
 * operator turned them on.
 *
 * NEAR Intents runs on mainnet only. There is no testnet, and a `.testnet` account is rejected as a recipient.
 */
import { CHAINS, isChain, type ChainId } from "@/lib/intents/addresses";

export type OneClickToken = { assetId: string; blockchain: string; symbol: string; decimals: number; price?: number; contractAddress?: string };

export type QuoteRequest = {
  dry: boolean;
  swapType: "EXACT_INPUT" | "EXACT_OUTPUT";
  slippageTolerance: number;
  originAsset: string;
  depositType: "ORIGIN_CHAIN";
  destinationAsset: string;
  /** Atomic units: of the output asset for EXACT_OUTPUT. */
  amount: string;
  refundTo: string;
  refundType: "ORIGIN_CHAIN";
  recipient: string;
  recipientType: "DESTINATION_CHAIN";
  /** ISO 8601. */
  deadline: string;
};

export type Quote = {
  depositAddress?: string;
  depositMemo?: string;
  amountIn: string;
  amountInFormatted: string;
  amountInUsd?: string;
  minAmountIn: string;
  amountOut: string;
  amountOutFormatted: string;
  amountOutUsd?: string;
  minAmountOut: string;
  deadline?: string;
  timeEstimate?: number;
  refundFee?: string;
  withdrawFee?: string;
};

export type QuoteResponse = { quote: Quote; quoteRequest: QuoteRequest & Record<string, unknown>; signature: string; timestamp: string; correlationId?: string };

export type SwapStatus = "KNOWN_DEPOSIT_TX" | "PENDING_DEPOSIT" | "INCOMPLETE_DEPOSIT" | "PROCESSING" | "SUCCESS" | "REFUNDED" | "FAILED";
export type StatusResponse = { status: SwapStatus; updatedAt?: string; quoteResponse?: QuoteResponse; swapDetails?: Record<string, unknown> };

/** Native USDC on NEAR (6 decimals): the asset a bid's payment check is funded in. */
export const NEAR_USDC_ASSET = "nep141:17208628f84f5d6ad33f0da3bbbeb27ffcb398eac501a31bd6ad2011e36133a1";
export const PAYMENT_DECIMALS = 6;

export class IntentsError extends Error {
  constructor(public readonly kind: "network" | "rejected" | "disabled" | "bad_response", message: string, public readonly status?: number) {
    super(message);
    this.name = "IntentsError";
  }
}

type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

export class IntentsClient {
  constructor(private readonly baseUrl: string, private readonly fetchImpl: FetchLike = (i, o) => fetch(i, o)) {}

  private async call<T>(path: string, init?: RequestInit): Promise<T> {
    let res: Response;
    try {
      res = await this.fetchImpl(`${this.baseUrl.replace(/\/+$/, "")}${path}`, { cache: "no-store", ...init, headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) } });
    } catch {
      throw new IntentsError("network", "Could not reach the funding service.");
    }
    const body = (await res.json().catch(() => null)) as { message?: string; error?: { code?: string; message?: string } } | null;
    if (!res.ok) {
      const message = body?.error?.message ?? body?.message ?? `The funding service answered ${res.status}.`;
      throw new IntentsError(body?.error?.code === "live_disabled" ? "disabled" : "rejected", message, res.status);
    }
    if (body === null) throw new IntentsError("bad_response", "The funding service sent something we could not read.");
    return body as T;
  }

  tokens() {
    return this.call<OneClickToken[]>("/tokens");
  }

  async quote(request: QuoteRequest): Promise<QuoteResponse> {
    const response = await this.call<QuoteResponse>("/quote", { method: "POST", body: JSON.stringify(request) });
    if (!response.quote?.amountIn || !response.quote?.amountOut) throw new IntentsError("bad_response", "The quote was missing its amounts.");
    return response;
  }

  status(depositAddress: string, depositMemo?: string) {
    const q = new URLSearchParams({ depositAddress, ...(depositMemo ? { depositMemo } : {}) });
    return this.call<StatusResponse>(`/status?${q}`);
  }
}

/** Dollars to atomic units of the 6-decimal payment token, rounded UP so a bid is never under-funded. */
export const dollarsToAtomic = (dollars: number) => String(Math.ceil(Math.round(dollars * 1e8) / 100));

/** The request for "deliver exactly this much USDC on NEAR, paid from that token on that chain". */
export function fundingRequest(input: { originAsset: string; amountUsd: number; refundTo: string; recipient: string; minutes?: number; now?: Date; dry?: boolean }): QuoteRequest {
  const now = input.now ?? new Date();
  return {
    dry: input.dry ?? true,
    swapType: "EXACT_OUTPUT",
    slippageTolerance: 100,
    originAsset: input.originAsset,
    depositType: "ORIGIN_CHAIN",
    destinationAsset: NEAR_USDC_ASSET,
    amount: dollarsToAtomic(input.amountUsd),
    refundTo: input.refundTo,
    refundType: "ORIGIN_CHAIN",
    recipient: input.recipient,
    recipientType: "DESTINATION_CHAIN",
    deadline: new Date(now.getTime() + (input.minutes ?? 30) * 60_000).toISOString(),
  };
}

/** Origin tokens worth offering: stablecoins and the chain's own coin, on chains whose addresses we can check. */
export function fundingOrigins(tokens: OneClickToken[]): OneClickToken[] {
  const wanted = new Set(["USDC", "USDT", "ETH", "SOL", "NEAR"]);
  const chains = new Set<string>(CHAINS.map((c) => c.id));
  return tokens
    .filter((t) => chains.has(t.blockchain) && wanted.has(t.symbol) && t.assetId !== NEAR_USDC_ASSET)
    .sort((a, b) => a.blockchain.localeCompare(b.blockchain) || a.symbol.localeCompare(b.symbol));
}

export const chainOf = (token: OneClickToken): ChainId | null => (isChain(token.blockchain) ? token.blockchain : null);

export type QuoteSummary = { pay: string; receive: string; costUsd: number | null; minPay: string; etaSeconds: number | null; refundFee: string | null; depositAddress: string | null; live: boolean };

export function summarizeQuote(response: QuoteResponse, origin: Pick<OneClickToken, "symbol" | "decimals">): QuoteSummary {
  const q = response.quote;
  const inUsd = q.amountInUsd ? Number(q.amountInUsd) : NaN;
  const outUsd = q.amountOutUsd ? Number(q.amountOutUsd) : NaN;
  const minPay = (Number(q.minAmountIn) / 10 ** origin.decimals).toString();
  return {
    pay: `${q.amountInFormatted} ${origin.symbol}`,
    receive: `${q.amountOutFormatted} USDC on NEAR`,
    costUsd: Number.isFinite(inUsd) && Number.isFinite(outUsd) ? Math.max(0, inUsd - outUsd) : null,
    minPay: `${minPay} ${origin.symbol}`,
    etaSeconds: q.timeEstimate ?? null,
    refundFee: q.refundFee ? `${q.refundFee} (atomic ${origin.symbol})` : null,
    depositAddress: q.depositAddress ?? null,
    live: !response.quoteRequest.dry && !!q.depositAddress,
  };
}
