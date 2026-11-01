import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  clearAuctionExact,
  decimalToAtomic,
  type ExactAuctionInput,
} from "../lib/auction-core";

const input = (overrides: Partial<ExactAuctionInput> = {}): ExactAuctionInput => ({
  version: "1",
  auctionId: "auction-1",
  // 1,000,000 whole tokens; tokenDecimals=0 in this small worked example.
  supply: "1000000",
  reservePrice: "1000000", // 0.01 payment token, with 8 payment decimals
  tokenDecimals: 0,
  bids: [
    { id: "A", bidder: "alice.near", limitPrice: "5000000", quantity: "400000" },
    { id: "B", bidder: "bob.near", limitPrice: "4000000", quantity: "300000" },
    { id: "C", bidder: "carol.near", limitPrice: "3000000", quantity: "300000" },
    { id: "D", bidder: "dave.near", limitPrice: "2000000", quantity: "200000" },
  ],
  ...overrides,
});

describe("integer uniform-price auction core v1", () => {
  it("clears the documented example at 0.03 and conserves every payment atomic unit", () => {
    const result = clearAuctionExact(input());
    assert.equal(result.clearingPrice, "3000000");
    assert.equal(result.sold, "1000000");
    assert.equal(result.unsold, "0");
    assert.equal(result.totalRaised, "3000000000000");
    assert.equal(result.totalLocked, "4500000000000");
    assert.equal(result.totalLocked, (BigInt(result.totalRaised) + BigInt(result.totalRefunded)).toString());
    const byId = Object.fromEntries(result.fills.map((fill) => [fill.bidId, fill]));
    assert.deepEqual([byId.A!.filled, byId.B!.filled, byId.C!.filled, byId.D!.filled], ["400000", "300000", "300000", "0"]);
    assert.equal(byId.A!.payment, "1200000000000");
    assert.equal(byId.D!.refund, byId.D!.locked);
  });

  it("leaves unsold supply when eligible demand is below supply", () => {
    const result = clearAuctionExact(input({
      supply: "1000000",
      bids: [
        { id: "A", bidder: "alice.near", limitPrice: "5000000", quantity: "200000" },
        { id: "B", bidder: "bob.near", limitPrice: "3000000", quantity: "100000" },
      ],
    }));
    assert.equal(result.clearingPrice, "1000000");
    assert.equal(result.sold, "300000");
    assert.equal(result.unsold, "700000");
  });

  it("allocates a marginal price tier pro-rata and deterministically", () => {
    const bids = [
      { id: "A", bidder: "a.near", limitPrice: "3000000", quantity: "5" },
      { id: "B", bidder: "b.near", limitPrice: "3000000", quantity: "5" },
      { id: "C", bidder: "c.near", limitPrice: "3000000", quantity: "5" },
    ];
    const result = clearAuctionExact(input({ supply: "10", bids }));
    const reversed = clearAuctionExact(input({ supply: "10", bids: [...bids].reverse() }));
    const allocations = Object.fromEntries(result.fills.map((fill) => [fill.bidId, fill.filled]));
    const reversedAllocations = Object.fromEntries(reversed.fills.map((fill) => [fill.bidId, fill.filled]));
    assert.deepEqual(allocations, { A: "4", B: "3", C: "3" });
    assert.deepEqual(allocations, reversedAllocations);
  });

  it("supports quantities and payments beyond JavaScript's safe integer range", () => {
    const result = clearAuctionExact(input({
      supply: "900719925474099300000",
      reservePrice: "1",
      tokenDecimals: 6,
      bids: [{
        id: "huge",
        bidder: "whale.near",
        limitPrice: "1234567",
        quantity: "900719925474099300000",
      }],
    }));
    assert.equal(result.sold, "900719925474099300000");
    assert.equal(result.totalRaised, "1111999096232782350504");
  });

  it("rounds locked collateral and payment up to payment-token atomic units", () => {
    const result = clearAuctionExact(input({
      supply: "1",
      reservePrice: "1",
      tokenDecimals: 1,
      bids: [{ id: "A", bidder: "alice.near", limitPrice: "1", quantity: "1" }],
    }));
    assert.equal(result.fills[0]!.locked, "1");
    assert.equal(result.fills[0]!.payment, "1");
    assert.equal(result.fills[0]!.refund, "0");
  });

  it("rejects duplicate IDs, non-canonical integers, zero quantities and invalid decimals", () => {
    assert.throws(() => clearAuctionExact(input({ bids: [
      { id: "same", bidder: "a.near", limitPrice: "1", quantity: "1" },
      { id: "same", bidder: "b.near", limitPrice: "1", quantity: "1" },
    ] })), /duplicate bid id/);
    assert.throws(() => clearAuctionExact(input({ supply: "01" })), /canonical unsigned integer/);
    assert.throws(() => clearAuctionExact(input({ bids: [{ id: "A", bidder: "a.near", limitPrice: "1", quantity: "0" }] })), /greater than zero/);
    assert.throws(() => clearAuctionExact(input({ tokenDecimals: 25 })), /tokenDecimals/);
  });

  it("rejects an empty identity and too many bids", () => {
    assert.throws(() => clearAuctionExact(input({ auctionId: "" })), /auctionId/);
    assert.throws(() => clearAuctionExact(input({ bids: Array.from({ length: 10_001 }, (_, i) => ({
      id: `bid-${i}`, bidder: `user-${i}`, limitPrice: "1", quantity: "1",
    })) })), /cannot exceed/);
  });

  it("converts human decimal strings without floating-point arithmetic", () => {
    assert.equal(decimalToAtomic("12.3401", 6), "12340100");
    assert.equal(decimalToAtomic("0.000001", 6), "1");
    assert.throws(() => decimalToAtomic("1.0000001", 6), /more than 6/);
    assert.throws(() => decimalToAtomic("1e-6", 18), /plain decimal/);
  });
});
