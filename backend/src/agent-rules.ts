/**
 * Agent rules, enforced when a launch settles. Mirrors src/lib/agent.ts in the frontend; both run the same
 * shared vectors (shared/test-vectors/agent-rules.json). An agent can only get a bid accepted inside the limits
 * its owner set, even if the agent itself ignores them.
 */
import { createHash } from "node:crypto";
import { verifyMessage } from "near-api-js/nep413";
import type { Provider } from "near-api-js";

export type AgentRules = {
  version: 1;
  owner: string;
  launchId: string;
  maxLimitPrice: number;
  maxQty: number;
  maxSpend: number;
  expiresAt: string;
  nonce: string;
};

/** What a sealed bid carries when an agent placed it. `signature` and `publicKey` are the owner's NEP-413 signature over the rules. */
export type AgentClaim = { rules: AgentRules; rulesHash: string; signature?: string; publicKey?: string };

export type Violation = "wrong_launch" | "wrong_owner" | "expired" | "not_positive" | "price_above_max" | "quantity_above_max" | "spend_above_max";

export const AGENT_RECIPIENT = "unmask.agent";

const scaled = (n: number) => Math.round(n * 1e8);

export const rulesMessage = (r: AgentRules) =>
  JSON.stringify(["unmask-agent-rules", r.version, r.owner, r.launchId, r.maxLimitPrice, r.maxQty, r.maxSpend, r.expiresAt, r.nonce]);

export const rulesHash = (r: AgentRules) => createHash("sha256").update(rulesMessage(r)).digest("hex");

/** The NEP-413 nonce for a rules signature: 32 bytes, derived from the message so one signature cannot be reused for other rules. */
export const rulesNonce = (r: AgentRules) => new Uint8Array(createHash("sha256").update(rulesMessage(r)).digest());

export function agentViolations(rules: AgentRules, bid: { launchId: string; bidder: string; limit: number; qty: number }, at: Date): Violation[] {
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

const isRules = (r: unknown): r is AgentRules => {
  const x = r as Partial<AgentRules> | null;
  return !!x && x.version === 1 && typeof x.owner === "string" && typeof x.launchId === "string" && typeof x.maxLimitPrice === "number" && typeof x.maxQty === "number" && typeof x.maxSpend === "number" && typeof x.expiresAt === "string" && typeof x.nonce === "string";
};

/**
 * null when the claim is acceptable, otherwise the reason to skip the bid.
 * Order: shape, hash, owner and launch, the owner's signature (if there is one), then the limits.
 */
export async function checkAgentClaim(
  claim: unknown,
  bid: { launchId: string; bidder: string; limit: number; qty: number },
  submittedAt: Date,
  provider: Pick<Provider, "viewAccessKey"> | null,
): Promise<{ problem: string | null; signed: boolean }> {
  const c = claim as Partial<AgentClaim> | null;
  if (!c || !isRules(c.rules) || typeof c.rulesHash !== "string") return { problem: "agent claim is malformed", signed: false };
  if (rulesHash(c.rules) !== c.rulesHash) return { problem: "agent rules hash does not match the rules", signed: false };

  let signed = false;
  if (c.signature) {
    if (!c.publicKey || !provider) return { problem: "agent rules signature cannot be checked", signed: false };
    try {
      const bytes = Buffer.from(c.signature, "base64");
      if (bytes.length !== 64) throw new Error("bad signature length");
      await verifyMessage({
        signerAccountId: c.rules.owner,
        signerPublicKey: c.publicKey,
        payload: { message: rulesMessage(c.rules), recipient: AGENT_RECIPIENT, nonce: rulesNonce(c.rules) },
        signature: new Uint8Array(bytes),
        provider: provider as Provider,
      });
      signed = true;
    } catch {
      return { problem: "agent rules signature is invalid", signed: false };
    }
  }

  const violations = agentViolations(c.rules, bid, submittedAt);
  if (violations.length) return { problem: `agent bid breaks its rules: ${violations.join(", ")}`, signed };
  return { problem: null, signed };
}
