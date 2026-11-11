/**
 * Pure settlement helpers: no database, no network. Turns decrypted bids into the exact auction input
 * the enclave engine runs, and hashes it. Everything here is deterministic so anyone can redo it.
 */
import { createHash } from "node:crypto";
import { checkAgentClaim, type AgentClaim } from "./agent-rules.js";
import type { Provider } from "near-api-js";

export type Destination = { chain: string; address: string };
export type PayoutPref = { refundTo?: Destination; tokensTo?: Destination };

export type PlainBid = {
  launchId: string;
  bidder: string;
  limit: number;
  qty: number;
  paymentCheck: { id: string; key: string };
  salt: string;
  /** Set when an agent placed this bid for its owner. */
  agent?: AgentClaim;
  /** Where the bidder wants refunds and tokens sent. Default: their own NEAR account. */
  payout?: PayoutPref;
};

// ---- where money may go -------------------------------------------------------------------------------------
// Same shapes as src/lib/intents/addresses.ts; both run shared/test-vectors/addresses.json.
const CHAINS = new Set(["near", "eth", "base", "arb", "sol"]);
const NEAR_NAMED = /^(?=.{2,64}$)([a-z0-9]+([-_][a-z0-9]+)*\.)*[a-z0-9]+([-_][a-z0-9]+)*$/;
const NEAR_IMPLICIT = /^[0-9a-f]{64}$/;
const EVM = /^0x[0-9a-fA-F]{40}$/;
const SOLANA = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

export function addressProblem(chain: string, address: string): string | null {
  if (!CHAINS.has(chain)) return `${chain} is not a supported chain`;
  const a = (address ?? "").trim();
  if (!a) return "enter an address";
  if (chain === "near") return NEAR_NAMED.test(a) || NEAR_IMPLICIT.test(a) ? null : "not a NEAR account id";
  if (chain === "sol") return SOLANA.test(a) ? null : "not a Solana address";
  return EVM.test(a) ? null : "not a 0x address with 40 hex characters";
}

export type ExactBidIn = { id: string; bidder: string; limitPrice: string; quantity: string };
export type ExactInput = {
  version: "1";
  auctionId: string;
  supply: string;
  reservePrice: string;
  tokenDecimals: number;
  bids: ExactBidIn[];
};

/** "0.0123" -> 12300 at 6 decimals. Rejects exponent form and extra precision so no float error leaks in. */
export function decimalToAtomic(value: number | string, decimals: number): string {
  const text = typeof value === "number" ? String(value) : value;
  if (!/^(0|[1-9][0-9]*)(\.[0-9]+)?$/.test(text)) throw new Error(`not a plain decimal: ${text}`);
  const [whole, fraction = ""] = text.split(".");
  if (fraction.length > decimals) throw new Error(`more than ${decimals} decimal places: ${text}`);
  return (BigInt(whole!) * 10n ** BigInt(decimals) + BigInt((fraction + "0".repeat(decimals)).slice(0, decimals) || "0")).toString();
}

/** The same bytes the browser hashes when it commits to a bid (src/lib/seal.ts `commitmentInput`). */
export const commitmentInput = (b: PlainBid) => JSON.stringify([b.launchId, b.bidder, b.limit, b.qty, b.paymentCheck.id, b.salt]);
export const sha256Hex = (data: string | Uint8Array) => createHash("sha256").update(data).digest("hex");

export type RowFacts = { id: string; bidder: string; commitment: string; paymentCheckId: string; checkAmountAtomic: string; checkLocked: boolean; submittedAt: Date };

export type Skipped = { bidId: string; reason: string };

/** Max a bid could owe: ceil(limitPrice * quantity / 10^tokenDecimals). */
export const maxOwed = (limitPrice: string, quantity: string, tokenDecimals: number) => {
  const n = BigInt(limitPrice) * BigInt(quantity);
  const d = 10n ** BigInt(tokenDecimals);
  return n === 0n ? 0n : (n + d - 1n) / d;
};

/**
 * Keep only bids that are honest: they decrypt, belong to this launch and bidder, match their commitment,
 * are backed by a locked payment check big enough to cover the most they could owe, and are well formed.
 * Everything else is skipped with a reason, never silently dropped.
 */
export type AcceptedMeta = { bidId: string; bidder: string; agent: { rulesHash: string; signed: boolean } | null; payout: PayoutPref | null };

export async function buildInput(
  launch: { id: string; supplyAtomic: string; reserveAtomic: string; tokenDecimals: number; paymentDecimals: number },
  rows: Array<{ row: RowFacts; plain: PlainBid | null }>,
  opts: { provider?: Pick<Provider, "viewAccessKey"> | null } = {},
): Promise<{ input: ExactInput; skipped: Skipped[]; meta: AcceptedMeta[] }> {
  const skipped: Skipped[] = [];
  const bids: ExactBidIn[] = [];
  const meta: AcceptedMeta[] = [];
  for (const { row, plain } of rows) {
    const skip = (reason: string) => skipped.push({ bidId: row.id, reason });
    if (!plain) { skip("could not be decrypted"); continue; }
    if (plain.launchId !== launch.id) { skip("sealed for a different launch"); continue; }
    if (plain.bidder !== row.bidder) { skip("bidder does not match"); continue; }
    if (sha256Hex(commitmentInput(plain)) !== row.commitment) { skip("commitment does not match"); continue; }
    if (plain.paymentCheck.id !== row.paymentCheckId) { skip("payment check does not match"); continue; }
    if (!row.checkLocked) { skip("payment check is not locked"); continue; }
    let limitPrice: string, quantity: string;
    try {
      limitPrice = decimalToAtomic(plain.limit, launch.paymentDecimals);
      quantity = decimalToAtomic(plain.qty, launch.tokenDecimals);
    } catch (e) { skip(e instanceof Error ? e.message : "bad amount"); continue; }
    if (BigInt(limitPrice) === 0n || BigInt(quantity) === 0n) { skip("zero price or quantity"); continue; }
    if (BigInt(row.checkAmountAtomic) < maxOwed(limitPrice, quantity, launch.tokenDecimals)) { skip("payment check does not cover the bid"); continue; }

    // Where refunds and tokens go. A bad address skips the bid: its funds come back through the payment check
    // instead of being sent somewhere nobody can use.
    let payout: PayoutPref | null = null;
    if (plain.payout) {
      const bad = (["refundTo", "tokensTo"] as const).flatMap((k) => {
        const d = plain.payout?.[k];
        if (!d) return [];
        // A new launch token is not carried by NEAR Intents, so tokens can only go to a NEAR account.
        const p = typeof d.chain === "string" && typeof d.address === "string" ? (k === "tokensTo" && d.chain !== "near" ? "tokens can only be sent to a NEAR account" : addressProblem(d.chain, d.address)) : "not a destination";
        return p ? [`${k}: ${p}`] : [];
      });
      if (bad.length) { skip(`invalid payout destination (${bad.join("; ")})`); continue; }
      payout = plain.payout;
    }

    // An agent's bid must sit inside the rules its owner set.
    let agent: AcceptedMeta["agent"] = null;
    if (plain.agent) {
      const checked = await checkAgentClaim(plain.agent, { launchId: plain.launchId, bidder: plain.bidder, limit: plain.limit, qty: plain.qty }, row.submittedAt, opts.provider ?? null);
      if (checked.problem) { skip(checked.problem); continue; }
      agent = { rulesHash: plain.agent.rulesHash, signed: checked.signed };
    }

    bids.push({ id: row.id, bidder: row.bidder, limitPrice, quantity });
    meta.push({ bidId: row.id, bidder: row.bidder, agent, payout });
  }
  bids.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  return {
    input: { version: "1", auctionId: launch.id, supply: launch.supplyAtomic, reservePrice: launch.reserveAtomic, tokenDecimals: launch.tokenDecimals, bids },
    skipped,
    meta,
  };
}

export type PlannedTransfer = {
  bidId: string;
  bidder: string;
  kind: "refund" | "tokens";
  amountAtomic: string;
  to: Destination;
  /** True when the destination is not NEAR, so the transfer would go through NEAR Intents. */
  viaIntents: boolean;
};

/**
 * What would be sent where once settlement moves money: each bidder's refund (locked minus paid) and their tokens.
 * This is a PLAN. Nothing here moves funds; real payouts need real payment checks and a deployed token.
 */
export function planPayouts(
  fills: Array<{ bidId: string; bidder: string; filled: string; refund: string }>,
  meta: AcceptedMeta[],
): PlannedTransfer[] {
  const byId = new Map(meta.map((m) => [m.bidId, m]));
  const out: PlannedTransfer[] = [];
  for (const f of fills) {
    const m = byId.get(f.bidId);
    if (!m) continue;
    const home: Destination = { chain: "near", address: f.bidder };
    const add = (kind: "refund" | "tokens", amount: string, to: Destination | undefined) => {
      if (BigInt(amount) === 0n) return;
      const dest = to ?? home;
      out.push({ bidId: f.bidId, bidder: f.bidder, kind, amountAtomic: amount, to: dest, viaIntents: dest.chain !== "near" });
    };
    add("refund", f.refund, m.payout?.refundTo);
    add("tokens", f.filled, m.payout?.tokensTo);
  }
  return out;
}

/** Hash of the canonical input: published before settling so nobody can swap the bids afterwards. */
export const inputHash = (input: ExactInput) => sha256Hex(JSON.stringify(input));
