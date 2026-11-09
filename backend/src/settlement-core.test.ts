import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildInput, commitmentInput, decimalToAtomic, inputHash, maxOwed, sha256Hex, type PlainBid } from "./settlement-core.js";

const launch = { id: "L1", supplyAtomic: "1000000", reserveAtomic: "10000", tokenDecimals: 0, paymentDecimals: 6 };
const plain = (over: Partial<PlainBid> = {}): PlainBid => ({ launchId: "L1", bidder: "a.near", limit: 0.05, qty: 400000, paymentCheck: { id: "pc1", key: "k" }, salt: "ab", ...over });
const row = (p: PlainBid, over = {}) => ({ id: "bid1", bidder: p.bidder, commitment: sha256Hex(commitmentInput(p)), paymentCheckId: p.paymentCheck.id, checkAmountAtomic: "20000000000", checkLocked: true, ...over });

describe("decimalToAtomic", () => {
  it("scales exactly", () => { assert.equal(decimalToAtomic(0.05, 6), "50000"); assert.equal(decimalToAtomic("1.5", 0 + 1), "15"); });
  it("rejects exponent form and extra precision", () => {
    assert.throws(() => decimalToAtomic(1e-7, 6));
    assert.throws(() => decimalToAtomic("0.0000001", 6));
  });
});

describe("buildInput", () => {
  it("keeps an honest bid and converts it to atomic units", () => {
    const p = plain();
    const { input, skipped } = buildInput(launch, [{ row: row(p), plain: p }]);
    assert.deepEqual(skipped, []);
    assert.deepEqual(input.bids, [{ id: "bid1", bidder: "a.near", limitPrice: "50000", quantity: "400000" }]);
  });
  const reasons = (p: PlainBid | null, r: object = {}) => buildInput(launch, [{ row: row(p ?? plain(), r), plain: p }]).skipped.map((s) => s.reason);
  it("skips what cannot be trusted, with a reason", () => {
    assert.deepEqual(reasons(null), ["could not be decrypted"]);
    assert.deepEqual(reasons(plain({ launchId: "OTHER" })), ["sealed for a different launch"]);
    assert.deepEqual(reasons(plain(), { bidder: "b.near" }), ["bidder does not match"]);
    assert.deepEqual(reasons(plain(), { commitment: "00" }), ["commitment does not match"]);
    assert.deepEqual(reasons(plain(), { paymentCheckId: "zz" }), ["payment check does not match"]);
    assert.deepEqual(reasons(plain(), { checkLocked: false }), ["payment check is not locked"]);
    assert.deepEqual(reasons(plain(), { checkAmountAtomic: "1" }), ["payment check does not cover the bid"]);
    assert.deepEqual(reasons(plain({ qty: 0 })), ["zero price or quantity"]);
  });
  it("orders bids by id so the input hash does not depend on database order", () => {
    const [a, b] = [plain({ bidder: "a.near" }), plain({ bidder: "b.near", paymentCheck: { id: "pc2", key: "k" } })];
    const rows = [{ row: row(b, { id: "z" }), plain: b }, { row: row(a, { id: "a" }), plain: a }];
    const one = buildInput(launch, rows).input, two = buildInput(launch, [...rows].reverse()).input;
    assert.equal(inputHash(one), inputHash(two));
  });
});

describe("maxOwed", () => {
  it("rounds up", () => assert.equal(maxOwed("3", "1", 1), 1n));
});
