import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { clearAuctionExact, type ExactAuctionInput, type ExactAuctionOutcome } from "@/lib/auction-core";

/**
 * Property tests: instead of hand-picked cases, check the guarantees of the rule on thousands of random auctions.
 * Small numbers on purpose, so ties, exact fits and rounding come up constantly. The generator is seeded, so a failure
 * reproduces: the message carries the seed and the iteration.
 */
function rng(seed: number) {
  let s = seed >>> 0;
  return (n: number) => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s % n; };
}

export function randomAuction(r: (n: number) => number, id: string): ExactAuctionInput {
  const decimals = r(4);
  const bids = Array.from({ length: r(13) }, (_, i) => ({
    id: `b${i}`,
    bidder: `u${i}.near`,
    limitPrice: String(1 + r(8)),
    quantity: String(1 + r(30)),
  }));
  return { version: "1", auctionId: id, supply: String(1 + r(50)), reservePrice: String(1 + r(5)), tokenDecimals: decimals, bids };
}

const ceilDiv = (a: bigint, b: bigint) => (a === 0n ? 0n : (a + b - 1n) / b);

function check(input: ExactAuctionInput, out: ExactAuctionOutcome, where: string) {
  const supply = BigInt(input.supply), reserve = BigInt(input.reservePrice), price = BigInt(out.clearingPrice);
  const scale = 10n ** BigInt(input.tokenDecimals);
  const byId = new Map(input.bids.map((b) => [b.id, b]));
  const eligible = input.bids.filter((b) => BigInt(b.limitPrice) >= reserve);
  const demand = eligible.reduce((s, b) => s + BigInt(b.quantity), 0n);
  const sold = out.fills.reduce((s, f) => s + BigInt(f.filled), 0n);

  assert.ok(sold <= supply, `${where}: sold ${sold} exceeds supply ${supply}`);
  assert.equal(BigInt(out.sold), sold, `${where}: reported sold`);
  assert.equal(BigInt(out.unsold), supply - sold, `${where}: unsold`);
  assert.equal(sold, demand >= supply ? supply : demand, `${where}: sells the whole supply if demand allows, otherwise all eligible demand`);
  assert.ok(price >= reserve, `${where}: clearing price below the reserve`);
  assert.equal(out.fills.length, input.bids.length, `${where}: one fill per bid, in the input order`);

  let totalLocked = 0n, totalPaid = 0n, totalRefund = 0n;
  const atPrice: Array<{ id: string; qty: bigint; filled: bigint }> = [];
  for (const [i, f] of out.fills.entries()) {
    const bid = byId.get(f.bidId)!;
    assert.equal(f.bidId, input.bids[i]!.id, `${where}: fills keep the input order`);
    const limit = BigInt(bid.limitPrice), qty = BigInt(bid.quantity), filled = BigInt(f.filled);
    assert.ok(filled <= qty, `${where}: ${f.bidId} got more than it asked for`);
    if (limit < reserve) assert.equal(filled, 0n, `${where}: ${f.bidId} is below the reserve and must get nothing`);
    if (filled > 0n) assert.ok(limit >= price, `${where}: ${f.bidId} won below the clearing price`);
    if (limit > price) assert.equal(filled, qty, `${where}: ${f.bidId} bid above the clearing price and must be filled in full`);
    if (limit === price && limit >= reserve) atPrice.push({ id: f.bidId, qty, filled });

    // everyone pays the same unit price, never their own limit, and never more than they locked
    const locked = ceilDiv(limit * qty, scale);
    assert.equal(BigInt(f.locked), locked, `${where}: ${f.bidId} locked`);
    assert.equal(BigInt(f.payment), ceilDiv(price * filled, scale), `${where}: ${f.bidId} pays the uniform price`);
    assert.ok(BigInt(f.payment) <= locked, `${where}: ${f.bidId} pays more than it locked`);
    assert.ok(BigInt(f.payment) <= ceilDiv(limit * filled, scale), `${where}: ${f.bidId} pays more than its own limit would cost`);
    assert.equal(BigInt(f.refund), locked - BigInt(f.payment), `${where}: ${f.bidId} refund`);
    totalLocked += locked; totalPaid += BigInt(f.payment); totalRefund += BigInt(f.refund);
  }
  assert.equal(totalLocked, totalPaid + totalRefund, `${where}: locked = paid + refunded`);
  assert.equal(BigInt(out.totalRaised), totalPaid, `${where}: totalRaised`);

  // At the marginal price the supply that is left is shared pro-rata in whole tokens. Everyone gets the rounded-down
  // share, and the leftover tokens go one each to the LARGEST remainders first, ties to the lowest bid id.
  const demandAtPrice = atPrice.reduce((s, b) => s + b.qty, 0n);
  const pot = atPrice.reduce((s, b) => s + b.filled, 0n);
  if (demandAtPrice > 0n && pot < demandAtPrice) {
    const shares = atPrice.map((b) => ({ ...b, exact: (pot * b.qty) / demandAtPrice, rem: (pot * b.qty) % demandAtPrice }));
    for (const b of shares) assert.ok(b.filled === b.exact || b.filled === b.exact + 1n, `${where}: ${b.id} got ${b.filled}, its share is ${b.exact} or one more`);
    const got = shares.filter((b) => b.filled === b.exact + 1n), missed = shares.filter((b) => b.filled === b.exact);
    for (const w of got) for (const l of missed) {
      assert.ok(w.rem > l.rem || (w.rem === l.rem && w.id < l.id), `${where}: ${w.id} (remainder ${w.rem}) got a crumb ahead of ${l.id} (remainder ${l.rem})`);
    }
  }
}

const SEED = 20261110;
const RUNS = 3000;

describe("auction rule: properties on random auctions", () => {
  it(`holds on ${RUNS} random auctions (seed ${SEED})`, () => {
    const r = rng(SEED);
    for (let i = 0; i < RUNS; i++) {
      const input = randomAuction(r, `p${i}`);
      check(input, clearAuctionExact(input), `seed ${SEED} #${i}`);
    }
  });

  it("does not depend on the order the bids arrived in", () => {
    const r = rng(SEED + 1);
    for (let i = 0; i < 1000; i++) {
      const input = randomAuction(r, `o${i}`);
      const shuffled = [...input.bids];
      for (let k = shuffled.length - 1; k > 0; k--) { const j = r(k + 1); [shuffled[k], shuffled[j]] = [shuffled[j]!, shuffled[k]!]; }
      const a = clearAuctionExact(input), b = clearAuctionExact({ ...input, bids: shuffled });
      assert.equal(a.clearingPrice, b.clearingPrice, `#${i}: price`);
      const sorted = (o: ExactAuctionOutcome) => [...o.fills].sort((x, y) => (x.bidId < y.bidId ? -1 : 1));
      assert.deepEqual(sorted(a), sorted(b), `#${i}: allocations`);
    }
  });

  it("is deterministic", () => {
    const r = rng(SEED + 2);
    for (let i = 0; i < 300; i++) { const input = randomAuction(r, `d${i}`); assert.deepEqual(clearAuctionExact(input), clearAuctionExact(input)); }
  });

  it("raising one bid's limit never makes it win less", () => {
    const r = rng(SEED + 3);
    for (let i = 0; i < 1500; i++) {
      const input = randomAuction(r, `m${i}`);
      if (input.bids.length === 0) continue;
      const k = r(input.bids.length);
      const before = BigInt(clearAuctionExact(input).fills[k]!.filled);
      const raised = { ...input, bids: input.bids.map((b, j) => (j === k ? { ...b, limitPrice: String(BigInt(b.limitPrice) + 1n + BigInt(r(3))) } : b)) };
      const after = BigInt(clearAuctionExact(raised).fills[k]!.filled);
      assert.ok(after >= before, `#${i}: bid ${k} got ${after} after raising its limit, was ${before}`);
    }
  });
});
