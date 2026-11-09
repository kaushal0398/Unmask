/**
 * A narrow proxy to NEAR Intents 1Click, used to fund a bid from another chain.
 *
 * - It only ever asks for USDC on NEAR as the output, so it cannot be used as a general swap relay.
 * - Live quotes (which return a real deposit address) are refused unless ONECLICK_ALLOW_LIVE=1. By default a
 *   quote is a dry run: a price, a fee and a time, with no address to pay.
 * - The optional ONECLICK_JWT stays on the server. Without it 1Click charges its default 0.1% fee.
 * - NEAR Intents is mainnet only; there is no testnet.
 */
import { z } from "zod";

export const NEAR_USDC_ASSET = "nep141:17208628f84f5d6ad33f0da3bbbeb27ffcb398eac501a31bd6ad2011e36133a1";

export const quoteSchema = z.object({
  dry: z.boolean(),
  swapType: z.literal("EXACT_OUTPUT"),
  slippageTolerance: z.number().int().min(10).max(500),
  originAsset: z.string().regex(/^nep141:[A-Za-z0-9._:-]{3,180}$/),
  depositType: z.literal("ORIGIN_CHAIN"),
  destinationAsset: z.literal(NEAR_USDC_ASSET),
  amount: z.string().regex(/^[1-9][0-9]{0,17}$/),
  refundTo: z.string().trim().min(2).max(100),
  refundType: z.literal("ORIGIN_CHAIN"),
  recipient: z.string().trim().min(2).max(100),
  recipientType: z.literal("DESTINATION_CHAIN"),
  deadline: z.string().datetime(),
});
export type QuoteBody = z.infer<typeof quoteSchema>;

export class ProxyError extends Error {
  constructor(public readonly status: number, public readonly code: string, message: string) {
    super(message);
  }
}

type FetchLike = (url: string, init?: RequestInit) => Promise<Response>;

export function createOneClickProxy(opts: { base?: string; jwt?: string; allowLive?: boolean; fetchImpl?: FetchLike; now?: () => number } = {}) {
  const base = (opts.base ?? "https://1click.chaindefuser.com").replace(/\/+$/, "");
  const doFetch: FetchLike = opts.fetchImpl ?? ((u, i) => fetch(u, i));
  const now = opts.now ?? Date.now;
  const headers = (): Record<string, string> => ({ "Content-Type": "application/json", ...(opts.jwt ? { Authorization: `Bearer ${opts.jwt}` } : {}) });

  async function upstream(path: string, init?: RequestInit): Promise<unknown> {
    let res: Response;
    try {
      res = await doFetch(`${base}${path}`, { ...init, headers: headers(), signal: AbortSignal.timeout(20_000) });
    } catch {
      throw new ProxyError(502, "upstream_unreachable", "NEAR Intents could not be reached.");
    }
    const body = (await res.json().catch(() => null)) as { message?: string } | unknown[] | null;
    if (!res.ok) {
      const message = body && !Array.isArray(body) && typeof body.message === "string" ? body.message : `NEAR Intents answered ${res.status}.`;
      throw new ProxyError(res.status === 401 || res.status === 403 ? 502 : res.status === 404 ? 404 : 400, "upstream_rejected", message);
    }
    return body;
  }

  let tokenCache: { at: number; body: unknown } | null = null;

  return {
    async tokens() {
      if (tokenCache && now() - tokenCache.at < 5 * 60_000) return tokenCache.body;
      const body = await upstream("/v0/tokens");
      tokenCache = { at: now(), body };
      return body;
    },

    async quote(raw: unknown) {
      const parsed = quoteSchema.safeParse(raw);
      if (!parsed.success) throw new ProxyError(400, "bad_request", `Invalid quote request: ${parsed.error.issues[0]?.path.join(".")} ${parsed.error.issues[0]?.message}`);
      const q = parsed.data;
      if (!q.dry && !opts.allowLive) {
        throw new ProxyError(403, "live_disabled", "Live quotes are switched off on this server. Ask for a dry run to preview the price.");
      }
      const deadline = Date.parse(q.deadline);
      if (deadline <= now() || deadline > now() + 2 * 3600_000) throw new ProxyError(400, "bad_request", "The deadline must be within the next two hours.");
      return upstream("/v0/quote", { method: "POST", body: JSON.stringify(q) });
    },

    async status(depositAddress: unknown, depositMemo?: unknown) {
      if (typeof depositAddress !== "string" || depositAddress.length < 4 || depositAddress.length > 200) throw new ProxyError(400, "bad_request", "depositAddress is required.");
      const q = new URLSearchParams({ depositAddress, ...(typeof depositMemo === "string" && depositMemo ? { depositMemo } : {}) });
      return upstream(`/v0/status?${q}`);
    },
  };
}
