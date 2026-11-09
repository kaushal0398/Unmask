import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { KeyPair, KeyPairSigner } from "near-api-js";
import { AGENT_RECIPIENT, agentViolations, rulesHash, rulesMessage, rulesNonce, type AgentClaim, type AgentRules } from "./agent-rules.js";
import { addressProblem, buildInput, commitmentInput, decimalToAtomic, inputHash, maxOwed, planPayouts, sha256Hex, type PlainBid } from "./settlement-core.js";

const shared = (f: string) => JSON.parse(readFileSync(new URL(`../../shared/test-vectors/${f}`, import.meta.url), "utf8"));
const launch = { id: "L1", supplyAtomic: "1000000", reserveAtomic: "10000", tokenDecimals: 0, paymentDecimals: 6 };
const T0 = new Date("2026-11-10T10:00:00Z");
const plain = (over: Partial<PlainBid> = {}): PlainBid => ({ launchId: "L1", bidder: "a.near", limit: 0.05, qty: 400000, paymentCheck: { id: "pc1", key: "k" }, salt: "ab", ...over });
const row = (p: PlainBid, over = {}) => ({ id: "bid1", bidder: p.bidder, commitment: sha256Hex(commitmentInput(p)), paymentCheckId: p.paymentCheck.id, checkAmountAtomic: "20000000000", checkLocked: true, submittedAt: T0, ...over });
const build = (p: PlainBid | null, r: object = {}, opts = {}) => buildInput(launch, [{ row: row(p ?? plain(), r), plain: p }], opts);

describe("decimalToAtomic", () => {
  it("scales exactly", () => { assert.equal(decimalToAtomic(0.05, 6), "50000"); assert.equal(decimalToAtomic("1.5", 1), "15"); });
  it("rejects exponent form and extra precision", () => {
    assert.throws(() => decimalToAtomic(1e-7, 6));
    assert.throws(() => decimalToAtomic("0.0000001", 6));
  });
});

describe("buildInput", () => {
  it("keeps an honest bid and converts it to atomic units", async () => {
    const p = plain();
    const { input, skipped } = await build(p);
    assert.deepEqual(skipped, []);
    assert.deepEqual(input.bids, [{ id: "bid1", bidder: "a.near", limitPrice: "50000", quantity: "400000" }]);
  });
  it("skips what cannot be trusted, with a reason", async () => {
    const reasons = async (p: PlainBid | null, r: object = {}) => (await build(p, r)).skipped.map((s) => s.reason);
    assert.deepEqual(await reasons(null), ["could not be decrypted"]);
    assert.deepEqual(await reasons(plain({ launchId: "OTHER" })), ["sealed for a different launch"]);
    assert.deepEqual(await reasons(plain(), { bidder: "b.near" }), ["bidder does not match"]);
    assert.deepEqual(await reasons(plain(), { commitment: "00" }), ["commitment does not match"]);
    assert.deepEqual(await reasons(plain(), { paymentCheckId: "zz" }), ["payment check does not match"]);
    assert.deepEqual(await reasons(plain(), { checkLocked: false }), ["payment check is not locked"]);
    assert.deepEqual(await reasons(plain(), { checkAmountAtomic: "1" }), ["payment check does not cover the bid"]);
    assert.deepEqual(await reasons(plain({ qty: 0 })), ["zero price or quantity"]);
  });
  it("orders bids by id so the input hash does not depend on database order", async () => {
    const [a, b] = [plain({ bidder: "a.near" }), plain({ bidder: "b.near", paymentCheck: { id: "pc2", key: "k" } })];
    const rows = [{ row: row(b, { id: "z" }), plain: b }, { row: row(a, { id: "a" }), plain: a }];
    assert.equal(inputHash((await buildInput(launch, rows)).input), inputHash((await buildInput(launch, [...rows].reverse())).input));
  });
});

describe("maxOwed", () => { it("rounds up", () => assert.equal(maxOwed("3", "1", 1), 1n)); });

describe("address shapes (shared vectors)", () => {
  for (const c of shared("addresses.json").cases) it(`${c.chain} ${JSON.stringify(c.address).slice(0, 30)}`, () => assert.equal(addressProblem(c.chain, c.address), c.problem));
});

describe("agent rules (shared vectors)", () => {
  const vec = shared("agent-rules.json");
  for (const c of vec.cases) it(c.name, () => assert.deepEqual(agentViolations({ ...vec.rules, ...(c.rulesOverride ?? {}) } as AgentRules, c.bid, new Date(c.atOverride ?? vec.at)), c.expected));
});

describe("agent bids at settlement", () => {
  const rules: AgentRules = { version: 1, owner: "a.near", launchId: "L1", maxLimitPrice: 0.05, maxQty: 400000, maxSpend: 20000, expiresAt: "2026-11-10T12:00:00.000Z", nonce: "n" };
  const claim = (r: AgentRules = rules): AgentClaim => ({ rules: r, rulesHash: rulesHash(r) });
  const noKey = { viewAccessKey: async () => { throw new Error("no key lookups expected"); } };

  it("accepts a bid inside its rules and marks the bid as an agent bid (unsigned)", async () => {
    const p = plain({ agent: claim() });
    const out = await build(p);
    assert.deepEqual(out.skipped, []);
    assert.deepEqual(out.meta[0]!.agent, { rulesHash: rulesHash(rules), signed: false });
  });
  it("skips a bid that breaks its rules, whatever the agent claims", async () => {
    const p = plain({ limit: 0.06, qty: 100, agent: claim() });
    assert.deepEqual((await build(p)).skipped.map((s) => s.reason), ["agent bid breaks its rules: price_above_max"]);
    const late = plain({ agent: claim() });
    assert.deepEqual((await build(late, { submittedAt: new Date("2026-11-10T13:00:00Z") })).skipped.map((s) => s.reason), ["agent bid breaks its rules: expired"]);
  });
  it("skips a claim whose hash was tampered with, or that is malformed", async () => {
    const p = plain({ agent: { ...claim(), rulesHash: "00".repeat(32) } });
    assert.deepEqual((await build(p)).skipped.map((s) => s.reason), ["agent rules hash does not match the rules"]);
    assert.deepEqual((await build(plain({ agent: { rules: { ...rules, maxQty: "lots" } } as unknown as AgentClaim }))).skipped.map((s) => s.reason), ["agent claim is malformed"]);
  });
  it("verifies the owner's real NEP-413 signature, and rejects a forged one", async () => {
    const keyPair = KeyPair.fromRandom("ed25519");
    const signer = new KeyPairSigner(keyPair);
    const signed = await signer.signNep413Message("a.near", { message: rulesMessage(rules), recipient: AGENT_RECIPIENT, nonce: rulesNonce(rules) });
    const good: AgentClaim = { ...claim(), signature: Buffer.from(signed.signature).toString("base64"), publicKey: keyPair.getPublicKey().toString() };
    const fullAccess = { viewAccessKey: async () => ({ permission: "FullAccess" }) } as never;
    const ok = await build(plain({ agent: good }), {}, { provider: fullAccess });
    assert.deepEqual(ok.skipped, []);
    assert.equal(ok.meta[0]!.agent!.signed, true);

    const otherKey = KeyPair.fromRandom("ed25519");
    const forged = { ...good, publicKey: otherKey.getPublicKey().toString() };
    assert.deepEqual((await build(plain({ agent: forged }), {}, { provider: fullAccess })).skipped.map((s) => s.reason), ["agent rules signature is invalid"]);
    const restricted = { viewAccessKey: async () => ({ permission: { FunctionCall: {} } }) } as never;
    assert.deepEqual((await build(plain({ agent: good }), {}, { provider: restricted })).skipped.map((s) => s.reason), ["agent rules signature is invalid"]);
    assert.deepEqual((await build(plain({ agent: good }), {}, { provider: noKey as never })).skipped.map((s) => s.reason), ["agent rules signature is invalid"]);
    // rules signed, but the signature was made over different rules
    const otherRules = { ...rules, maxQty: 999999 };
    const swapped = { rules: otherRules, rulesHash: rulesHash(otherRules), signature: good.signature, publicKey: good.publicKey };
    assert.deepEqual((await build(plain({ agent: swapped as AgentClaim }), {}, { provider: fullAccess })).skipped.map((s) => s.reason), ["agent rules signature is invalid"]);
  });
});

describe("payout destinations", () => {
  const arb = "0x2527D02599Ba641c19FEa793cD0F167589a0f10D";
  it("accepts good destinations and skips a bid with a bad one (its funds come back through the payment check)", async () => {
    const ok = plain({ payout: { refundTo: { chain: "arb", address: arb }, tokensTo: { chain: "near", address: "me.near" } } });
    assert.deepEqual((await build(ok)).skipped, []);
    const bad = plain({ payout: { refundTo: { chain: "arb", address: "0x123" } } });
    assert.deepEqual((await build(bad)).skipped.map((s) => s.reason), ["invalid payout destination (refundTo: not a 0x address with 40 hex characters)"]);
    const tokensAway = plain({ payout: { tokensTo: { chain: "arb", address: arb } } });
    assert.deepEqual((await build(tokensAway)).skipped.map((s) => s.reason), ["invalid payout destination (tokensTo: tokens can only be sent to a NEAR account)"]);
    const dogecoin = plain({ payout: { refundTo: { chain: "doge", address: "D8vFz4p7" } } });
    assert.match((await build(dogecoin)).skipped[0]!.reason, /doge is not a supported chain/);
  });
  it("plans refunds and tokens per bid, defaulting to the bidder's NEAR account, and flags cross-chain ones", async () => {
    const a = plain({ bidder: "a.near", payout: { refundTo: { chain: "arb", address: arb } } });
    const b = plain({ bidder: "b.near", paymentCheck: { id: "pc2", key: "k" } });
    const { meta } = await buildInput(launch, [{ row: row(a, { id: "A" }), plain: a }, { row: row(b, { id: "B" }), plain: b }]);
    const plan = planPayouts([
      { bidId: "A", bidder: "a.near", filled: "100", refund: "5000" },
      { bidId: "B", bidder: "b.near", filled: "0", refund: "7000" },
      { bidId: "ghost", bidder: "x.near", filled: "1", refund: "1" },
    ], meta);
    assert.deepEqual(plan, [
      { bidId: "A", bidder: "a.near", kind: "refund", amountAtomic: "5000", to: { chain: "arb", address: arb }, viaIntents: true },
      { bidId: "A", bidder: "a.near", kind: "tokens", amountAtomic: "100", to: { chain: "near", address: "a.near" }, viaIntents: false },
      { bidId: "B", bidder: "b.near", kind: "refund", amountAtomic: "7000", to: { chain: "near", address: "b.near" }, viaIntents: false },
    ]);
  });
});
