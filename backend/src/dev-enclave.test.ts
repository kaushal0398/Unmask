import assert from "node:assert/strict";
import { describe, it } from "node:test";
import sodium from "libsodium-wrappers";
import { devEnclaveKey, engineCodeHash, openBid, runEngine, runEngineRaw } from "./dev-enclave.js";
import { buildInput, commitmentInput, inputHash, sha256Hex, type PlainBid } from "./settlement-core.js";

await sodium.ready;
const launch = { id: "L1", supplyAtomic: "1000000", reserveAtomic: "10000", tokenDecimals: 0, paymentDecimals: 6 };

/** Seal exactly as the browser does (src/lib/seal.ts). */
const seal = (plain: PlainBid) => sodium.to_base64(sodium.crypto_box_seal(sodium.from_string(JSON.stringify(plain)), Uint8Array.from(Buffer.from(devEnclaveKey().publicKey, "hex"))), sodium.base64_variants.ORIGINAL);
const bid = (n: string, limit: number, qty: number): PlainBid => ({ launchId: "L1", bidder: `${n}.near`, limit, qty, paymentCheck: { id: `pc-${n}`, key: "k" }, salt: `salt-${n}` });
const rowOf = (p: PlainBid, id: string) => ({ id, bidder: p.bidder, commitment: sha256Hex(commitmentInput(p)), paymentCheckId: p.paymentCheck.id, checkAmountAtomic: "999999999999", checkLocked: true, submittedAt: new Date() });

describe("dev enclave end to end (browser seal -> open -> Rust engine)", () => {
  it("round-trips a sealed bid and rejects garbage", () => {
    const p = bid("a", 0.05, 100);
    assert.deepEqual(openBid(seal(p)), p);
    assert.equal(openBid("not-base64-at-all"), null);
    assert.equal(openBid(sodium.to_base64(sodium.randombytes_buf(80), sodium.base64_variants.ORIGINAL)), null);
  });

  it("clears the README example through the real engine binary", async () => {
    const plains = [bid("a", 0.05, 400000), bid("b", 0.04, 300000), bid("c", 0.03, 300000), bid("d", 0.02, 200000)];
    const rows = plains.map((p, i) => ({ row: rowOf(p, `bid${i}`), plain: openBid(seal(p)) }));
    const { input, skipped } = await buildInput({ ...launch, reserveAtomic: "10000" }, rows);
    assert.deepEqual(skipped, []);
    const out = (await runEngine(input)) as { clearingPrice: string; sold: string; totalRaised: string; fills: Array<{ bidId: string; filled: string; payment: string; refund: string }> };
    assert.equal(out.clearingPrice, "30000");                       // $0.03 at 6 decimals
    assert.equal(out.sold, "1000000");
    assert.equal(out.totalRaised, "30000000000");                  // $30,000
    assert.deepEqual(out.fills.map((f) => f.filled), ["400000", "300000", "300000", "0"]);
    assert.equal(out.fills[0]!.payment, "12000000000");            // A pays $12,000, not $0.05 x 400,000
    assert.equal(inputHash(input), inputHash(input));
  });

  it("is reproducible: same bids, any order, same input hash and same result", async () => {
    const plains = [bid("a", 0.05, 600000), bid("b", 0.05, 600000), bid("c", 0.02, 100000)];
    const mk = async (order: number[]) => (await buildInput(launch, order.map((i) => ({ row: rowOf(plains[i]!, `bid${i}`), plain: openBid(seal(plains[i]!)) })))).input;
    const one = await mk([0, 1, 2]), two = await mk([2, 1, 0]);
    assert.equal(inputHash(one), inputHash(two));
    assert.deepEqual(await runEngine(one), await runEngine(two));
  });

  it("surfaces the engine's own error for an invalid input", async () => {
    await assert.rejects(runEngine({ version: "1", auctionId: "x", supply: "0", reservePrice: "1", tokenDecimals: 0, bids: [] }), /supply must be greater than zero/);
  });

  it("returns the engine's exact output bytes, so the output hash is the hash of what the engine wrote", async () => {
    const input = (await buildInput(launch, [{ row: rowOf(bid("a", 0.05, 100), "bid0"), plain: openBid(seal(bid("a", 0.05, 100))) }])).input;
    const raw = await runEngineRaw(input);
    assert.equal(typeof raw, "string");
    assert.equal(raw, JSON.stringify(JSON.parse(raw)), "compact JSON, nothing reformatted");
    assert.equal(sha256Hex(raw), sha256Hex(await runEngineRaw(input)), "the same input always gives the same output hash");
    assert.deepEqual(await runEngine(input), JSON.parse(raw));
  });

  it("publishes a stable code hash for the engine binary", () => assert.match(engineCodeHash(), /^[0-9a-f]{64}$/));
});
