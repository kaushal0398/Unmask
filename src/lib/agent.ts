/**
 * Agent bidding within signed rules.
 *
 * The owner signs a small set of limits. An agent may place a sealed bid for them, but only inside those limits.
 * The same check runs again when the launch settles (backend/src/settlement-core.ts), so a misbehaving agent cannot
 * get a bid accepted by breaking its rules. Both sides are tested against shared/test-vectors/agent-rules.json.
 *
 * Why the agent bids its maximum price: in a uniform-price auction every winner pays the clearing price, not their
 * own limit, so bidding your true maximum cannot make you pay more than that. The rules still cap the quantity and
 * the most the agent could lock.
 */

export type AgentRules = {
  version: 1;
  /** The account that signs the rules and whose bid it is. */
  owner: string;
  launchId: string;
  /** Most the agent may offer per token, in dollars. */
  maxLimitPrice: number;
  /** Most tokens the agent may ask for. */
  maxQty: number;
  /** Most the agent may lock for one bid (limit x quantity), in dollars. */
  maxSpend: number;
  /** ISO 8601. The rules stop applying at this time. */
  expiresAt: string;
  /** Random, so the same limits signed twice are different rules. */
  nonce: string;
};

export type AgentBidIntent = { launchId: string; bidder: string; limit: number; qty: number };

export type Violation = "wrong_launch" | "wrong_owner" | "expired" | "not_positive" | "price_above_max" | "quantity_above_max" | "spend_above_max";

/** Money compared as integers (1e-8) so 0.1 x 3 never trips a float error. */
const scaled = (n: number) => Math.round(n * 1e8);

/** The exact text the owner signs. Fixed field order, so it hashes the same everywhere. */
export const rulesMessage = (r: AgentRules) =>
  JSON.stringify(["unmask-agent-rules", r.version, r.owner, r.launchId, r.maxLimitPrice, r.maxQty, r.maxSpend, r.expiresAt, r.nonce]);

/** Recipient and nonce for the owner's NEP-413 signature over the rules. The backend rebuilds both to verify it. */
export const AGENT_RECIPIENT = "unmask.agent";

export async function rulesNonce(r: AgentRules): Promise<Uint8Array> {
  return new Uint8Array(await globalThis.crypto.subtle.digest("SHA-256", new TextEncoder().encode(rulesMessage(r))));
}

/** What a sealed bid carries when an agent placed it for its owner. */
export type AgentClaim = { rules: AgentRules; rulesHash: string; signature?: string; publicKey?: string };

export async function rulesHash(r: AgentRules): Promise<string> {
  const bytes = new TextEncoder().encode(rulesMessage(r));
  const digest = await globalThis.crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

/** Every rule this bid breaks. An empty list means the agent may place it. */
export function agentViolations(rules: AgentRules, bid: AgentBidIntent, at: Date): Violation[] {
  const out: Violation[] = [];
  if (bid.launchId !== rules.launchId) out.push("wrong_launch");
  if (bid.bidder !== rules.owner) out.push("wrong_owner");
  if (!(at.getTime() < Date.parse(rules.expiresAt))) out.push("expired");
  if (!(bid.limit > 0) || !(bid.qty > 0)) out.push("not_positive");
  if (scaled(bid.limit) > scaled(rules.maxLimitPrice)) out.push("price_above_max");
  if (bid.qty > rules.maxQty) out.push("quantity_above_max");
  if (Math.round(bid.limit * bid.qty * 1e8) > scaled(rules.maxSpend)) out.push("spend_above_max");
  return out;
}

export const VIOLATION_TEXT: Record<Violation, string> = {
  wrong_launch: "the rules were signed for a different launch",
  wrong_owner: "the bid is not for the account that signed the rules",
  expired: "the rules have expired",
  not_positive: "the price and quantity must be positive",
  price_above_max: "the price is above the signed maximum",
  quantity_above_max: "the quantity is above the signed maximum",
  spend_above_max: "the most this bid could lock is above the signed maximum",
};

export type Proposal = { ok: true; limit: number; qty: number } | { ok: false; reason: string };

/** What the agent would bid: its maximum price, for as many tokens as the rules and the launch allow. */
export function proposeBid(rules: AgentRules, ctx: { reserve: number; supply: number; capBps: number | null; at: Date }): Proposal {
  if (!(ctx.at.getTime() < Date.parse(rules.expiresAt))) return { ok: false, reason: VIOLATION_TEXT.expired };
  const limit = rules.maxLimitPrice;
  if (!(limit > 0)) return { ok: false, reason: "the signed maximum price must be positive" };
  if (scaled(limit) < scaled(ctx.reserve)) return { ok: false, reason: "the signed maximum price is below the reserve, so no bid could win" };
  const byCap = ctx.capBps ? Math.floor((ctx.supply * ctx.capBps) / 10_000) : Number.POSITIVE_INFINITY;
  const bySpend = Math.floor((rules.maxSpend * 1e8) / scaled(limit));
  const qty = Math.min(rules.maxQty, bySpend, byCap, ctx.supply);
  if (!(qty >= 1)) return { ok: false, reason: "the signed limits do not allow even one token at that price" };
  return { ok: true, limit, qty };
}

export function newRules(input: { owner: string; launchId: string; maxLimitPrice: number; maxQty: number; maxSpend: number; minutes: number; now: Date; nonce: string }): AgentRules {
  return {
    version: 1,
    owner: input.owner,
    launchId: input.launchId,
    maxLimitPrice: input.maxLimitPrice,
    maxQty: input.maxQty,
    maxSpend: input.maxSpend,
    expiresAt: new Date(input.now.getTime() + input.minutes * 60_000).toISOString(),
    nonce: input.nonce,
  };
}
