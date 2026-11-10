/**
 * End-to-end check of settlement against a REAL database and a RUNNING backend.
 *   DATABASE_URL=... API_URL=http://127.0.0.1:4011 npx tsx scripts/e2e-settle.ts
 * It seeds a closed launch with sealed bids (honest and dishonest), settles over HTTP and checks the result.
 * Use a throwaway database: it writes rows.
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import sodium from "libsodium-wrappers";
import { rulesHash, type AgentRules } from "../src/agent-rules.js";
import { commitmentInput, sha256Hex, type PlainBid } from "../src/settlement-core.js";

await sodium.ready;
const prisma = new PrismaClient();
const API = (process.env.API_URL ?? "http://127.0.0.1:4011").replace(/\/+$/, "");
const run = Date.now().toString(36);
const creator = `creator-${run}.testnet`;

const call = async (path: string, init: RequestInit = {}, token?: string) => {
  const res = await fetch(API + path, { ...(init.method === "POST" ? { body: "{}" } : {}), ...init, headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) } });
  return { status: res.status, body: (await res.json().catch(() => null)) as any };
};

// 1. the key bids are sealed to
const { body: keyBody } = await call("/v1/enclave-key");
const publicKey = Uint8Array.from(Buffer.from(keyBody.key.publicKey, "hex"));
const seal = (p: PlainBid) => sodium.to_base64(sodium.crypto_box_seal(sodium.from_string(JSON.stringify(p)), publicKey), sodium.base64_variants.ORIGINAL);

// 2. a closed launch: 1,000,000 tokens, reserve $0.01, payment token has 6 decimals
const launch = await prisma.launch.create({
  data: { name: "E2E", symbol: "E2E", creator, supplyAtomic: "1000000", reserveAtomic: "10000", tokenDecimals: 0, paymentToken: "usdc.test", paymentDecimals: 6, state: "OPEN", opensAt: new Date(Date.now() - 7200_000), closesAt: new Date(Date.now() - 60_000) },
});

let n = 0;
async function addBid(who: string, limit: number, qty: number, opts: { badCommitment?: boolean; unlocked?: boolean; extra?: Partial<PlainBid> } = {}) {
  n++;
  const plain: PlainBid = { launchId: launch.id, bidder: who, limit, qty, paymentCheck: { id: "", key: `claim-${n}` }, salt: `salt-${n}`, ...(opts.extra ?? {}) };
  const check = await prisma.paymentCheck.create({ data: { launchId: launch.id, bidder: who, token: "usdc.test", amountAtomic: "999999999999", state: opts.unlocked ? "RECLAIMED" : "LOCKED", expiresAt: new Date(Date.now() + 3600_000) } });
  plain.paymentCheck.id = check.id;
  return prisma.bid.create({ data: { launchId: launch.id, bidder: who, ciphertext: seal(plain), commitment: opts.badCommitment ? "00".repeat(32) : sha256Hex(commitmentInput(plain)), paymentCheckId: check.id, keyId: keyBody.key.keyId, receiptId: `r-${run}-${n}` } });
}

// the README example, plus two bids that must be rejected
await addBid("a.testnet", 0.05, 400000);
await addBid("b.testnet", 0.04, 300000);
await addBid("c.testnet", 0.03, 300000);
await addBid("d.testnet", 0.02, 200000);
await addBid("liar.testnet", 9, 5000000, { badCommitment: true });
await addBid("unfunded.testnet", 9, 5000000, { unlocked: true });

// an agent inside its rules, an agent outside them, a bidder with a cross-chain refund, and one with a bad address
const rulesFor = (owner: string): AgentRules => ({ version: 1, owner, launchId: launch.id, maxLimitPrice: 0.05, maxQty: 1000, maxSpend: 50, expiresAt: new Date(Date.now() + 3600_000).toISOString(), nonce: "e2e" });
const claim = (owner: string) => ({ rules: rulesFor(owner), rulesHash: rulesHash(rulesFor(owner)) });
const ARB = "0x2527D02599Ba641c19FEa793cD0F167589a0f10D";
await addBid("agent-ok.testnet", 0.02, 1000, { extra: { agent: claim("agent-ok.testnet") } });
await addBid("agent-bad.testnet", 0.08, 100, { extra: { agent: claim("agent-bad.testnet") } });
await addBid("cross.testnet", 0.02, 100, { extra: { payout: { refundTo: { chain: "arb", address: ARB } } } });
await addBid("badaddr.testnet", 0.02, 100, { extra: { payout: { refundTo: { chain: "arb", address: "0x123" } } } });

// 3. a creator session, and a stranger's
const session = async (accountId: string) => {
  const token = `e2e-${run}-${accountId}`;
  await prisma.authSession.create({ data: { accountId, publicKey: "ed25519:test", tokenHash: createHash("sha256").update(token).digest("hex"), expiresAt: new Date(Date.now() + 3600_000) } });
  return token;
};
const creatorToken = await session(creator);
const strangerToken = await session(`stranger-${run}.testnet`);

// 4. checks
assert.equal((await call(`/v1/launches/${launch.id}/settle`, { method: "POST" })).status, 401, "needs a session");
assert.equal((await call(`/v1/launches/${launch.id}/settle`, { method: "POST" }, strangerToken)).status, 403, "creator only");
assert.equal((await call(`/v1/launches/${launch.id}/result`)).status, 404, "no result before settling");

const first = await call(`/v1/launches/${launch.id}/settle`, { method: "POST" }, creatorToken);
assert.equal(first.status, 200, JSON.stringify(first.body));
const r = first.body.result;
assert.equal(first.body.alreadySettled, false);
assert.equal(r.clearingPrice, "30000", "clears at $0.03");
assert.equal(r.sold, "1000000");
assert.equal(r.totalRaised, "30000000000", "$30,000");
assert.equal(r.skippedBids, 4, "the liar, the unfunded bid, the rule-breaking agent and the bad address are skipped");
assert.equal(r.mode, "dev");
assert.match(r.outcome.engineOutputHash, /^[0-9a-f]{64}$/, "the output hash is recorded");
assert.ok(["native", "wasm"].includes(r.outcome.engineKind));
assert.equal(r.attestation, null, "dev results are never attested");
assert.match(r.inputHash, /^[0-9a-f]{64}$/);
assert.match(r.codeHash, /^[0-9a-f]{64}$/);
const skippedReasons = r.outcome.skipped.map((s: { reason: string }) => s.reason).sort();
assert.deepEqual(skippedReasons, [
  "agent bid breaks its rules: price_above_max",
  "commitment does not match",
  "invalid payout destination (refundTo: not a 0x address with 40 hex characters)",
  "payment check is not locked",
]);
type Fill = { bidder: string; filled: string; payment: string; refund: string };
const byBidder = (name: string) => r.outcome.fills.find((f: Fill) => f.bidder === name) as Fill;
assert.deepEqual(["a", "b", "c", "d"].map((x) => byBidder(`${x}.testnet`).filled), ["400000", "300000", "300000", "0"]);
assert.equal(byBidder("agent-ok.testnet").filled, "0", "the agent bid at $0.02 is below the clearing price");
assert.equal(r.outcome.fills.some((f: Fill) => f.bidder === "agent-bad.testnet" || f.bidder === "badaddr.testnet"), false, "rejected bids are not in the auction");

// agents are recorded, unsigned because no wallet signed them here
assert.deepEqual(r.outcome.agents.map((a: { bidder: string; signed: boolean }) => [a.bidder, a.signed]), [["agent-ok.testnet", false]]);

// the payout plan: a cross-chain refund goes through NEAR Intents, everything else stays on NEAR, nothing is executed
const plan = r.outcome.payouts as Array<{ bidder: string; kind: string; amountAtomic: string; to: { chain: string; address: string }; viaIntents: boolean }>;
const crossRefund = plan.find((t) => t.bidder === "cross.testnet" && t.kind === "refund")!;
assert.deepEqual(crossRefund.to, { chain: "arb", address: ARB });
assert.equal(crossRefund.viaIntents, true);
assert.equal(crossRefund.amountAtomic, "2000000", "$0.02 x 100 tokens = $2.00, all refunded");
const aTokens = plan.find((t) => t.bidder === "a.testnet" && t.kind === "tokens")!;
assert.deepEqual(aTokens.to, { chain: "near", address: "a.testnet" });
assert.equal(aTokens.viaIntents, false);
assert.equal(plan.some((t) => t.bidder === "badaddr.testnet"), false);
assert.equal(r.outcome.payoutsExecuted, false, "no money moves");

const again = await call(`/v1/launches/${launch.id}/settle`, { method: "POST" }, creatorToken);
assert.equal(again.body.alreadySettled, true, "settling twice returns the stored result");
assert.equal(again.body.result.inputHash, r.inputHash);

const result = await call(`/v1/launches/${launch.id}/result`);
assert.equal(result.status, 200);
assert.equal(result.body.result.clearingPrice, "30000");
assert.equal((await call(`/v1/launches/${launch.id}`)).body.launch.status, "settled");
assert.equal(await prisma.settlement.count({ where: { launchId: launch.id } }), 1, "exactly one stored settlement");

// an open launch cannot be settled yet
const open = await prisma.launch.create({ data: { name: "Open", symbol: "OPN", creator, supplyAtomic: "10", reserveAtomic: "1", tokenDecimals: 0, paymentToken: "usdc.test", paymentDecimals: 6, state: "OPEN", closesAt: new Date(Date.now() + 3600_000) } });
assert.equal((await call(`/v1/launches/${open.id}/settle`, { method: "POST" }, creatorToken)).status, 409, "window still open");

// NEAR Intents proxy: live quotes are refused, bad requests are refused, and a dry quote reaches the real service
const quoteBody = { dry: true, swapType: "EXACT_OUTPUT", slippageTolerance: 100, originAsset: "nep141:arb-0xaf88d065e77c8cc2239327c5edb3a432268e5831.omft.near", depositType: "ORIGIN_CHAIN", destinationAsset: "nep141:17208628f84f5d6ad33f0da3bbbeb27ffcb398eac501a31bd6ad2011e36133a1", amount: "5000000", refundTo: ARB, refundType: "ORIGIN_CHAIN", recipient: "alice.near", recipientType: "DESTINATION_CHAIN", deadline: new Date(Date.now() + 30 * 60_000).toISOString() };
const live = await call("/v1/intents/quote", { method: "POST", body: JSON.stringify({ ...quoteBody, dry: false }) });
assert.equal(live.status, 403);
assert.equal(live.body.error.code, "live_disabled");
const wrongAsset = await call("/v1/intents/quote", { method: "POST", body: JSON.stringify({ ...quoteBody, destinationAsset: "nep141:wrap.near" }) });
assert.equal(wrongAsset.status, 400);
let intents = "skipped (no network)";
const dry = await call("/v1/intents/quote", { method: "POST", body: JSON.stringify(quoteBody) });
if (dry.status === 200 || dry.status === 201) {
  assert.equal(dry.body.quote.amountOut, "5000000");
  assert.equal(dry.body.quote.depositAddress, undefined, "a dry quote has no deposit address");
  intents = `real dry quote: pay ${dry.body.quote.amountInFormatted} USDC on Arbitrum to deliver 5 USDC on NEAR`;
}

console.log("e2e settle: all checks passed");
console.log("intents:", intents);
console.log(JSON.stringify({ launch: launch.id, clearingPrice: r.clearingPrice, sold: r.sold, raised: r.totalRaised, skipped: skippedReasons, inputHash: r.inputHash.slice(0, 16) + "…", codeHash: r.codeHash.slice(0, 16) + "…" }, null, 2));
await prisma.$disconnect();
