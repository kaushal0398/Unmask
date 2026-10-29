import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { clearAuction, type Bid } from "@/lib/auction";

const bid = (id: string, limit: number, qty: number): Bid => ({ id, label: id, limit, qty });
const near = (a: number, b: number) => assert.ok(Math.abs(a - b) < 1e-9, `${a} vs ${b}`);

describe("the uniform-price sealed-bid auction", () => {
  it("clears the worked example from the docs: price $0.03, A, B and C fill, D is refunded", () => {
    const o = clearAuction([bid("A", 0.05, 400_000), bid("B", 0.04, 300_000), bid("C", 0.03, 300_000), bid("D", 0.02, 200_000)], 1_000_000, 0.01);
    near(o.price, 0.03);
    const by = Object.fromEntries(o.fills.map((f) => [f.bid.id, f]));
    assert.deepEqual([by.A!.filled, by.B!.filled, by.C!.filled, by.D!.filled], [400_000, 300_000, 300_000, 0]);
    near(by.A!.pays, 12_000);
    near(by.B!.pays, 9_000);
    near(by.C!.pays, 9_000);
    near(o.raised, 30_000);
    near(by.D!.refund, 0.02 * 200_000);
    near(by.A!.refund, 0.05 * 400_000 - 12_000);
    assert.equal(o.sold, 1_000_000);
  });

  it("every winner pays the same price, whatever they bid", () => {
    const o = clearAuction([bid("A", 0.09, 500_000), bid("B", 0.02, 600_000)], 1_000_000, 0.01);
    near(o.price, 0.02);
    for (const f of o.fills.filter((x) => x.filled > 0)) near(f.pays / f.filled, o.price);
  });

  it("arriving first or last changes nothing: the order bids are given in does not matter", () => {
    const bids = [bid("A", 0.05, 400_000), bid("B", 0.04, 300_000), bid("C", 0.03, 300_000), bid("D", 0.02, 200_000)];
    const a = clearAuction(bids, 1_000_000, 0.01);
    const b = clearAuction([...bids].reverse(), 1_000_000, 0.01);
    near(a.price, b.price);
    const pick = (o: typeof a) => Object.fromEntries(o.fills.map((f) => [f.bid.id, f.filled]));
    assert.deepEqual(pick(a), pick(b));
  });

  it("falls back to the reserve when demand is short, and leaves the rest unsold", () => {
    const o = clearAuction([bid("A", 0.05, 200_000), bid("B", 0.03, 100_000)], 1_000_000, 0.01);
    near(o.price, 0.01);
    assert.deepEqual([o.sold, o.unsold], [300_000, 700_000]);
  });

  it("shares the supply pro-rata among bids at the clearing price, in whole tokens", () => {
    const o = clearAuction([bid("A", 0.05, 600_000), bid("B", 0.03, 300_000), bid("C", 0.03, 300_000), bid("D", 0.03, 400_000)], 1_000_000, 0.01);
    near(o.price, 0.03);
    const by = Object.fromEntries(o.fills.map((f) => [f.bid.id, f.filled]));
    assert.equal(by.A, 600_000);
    assert.equal(by.B! + by.C! + by.D!, 400_000, "exactly the supply left");
    assert.deepEqual([by.B, by.C, by.D], [120_000, 120_000, 160_000]);
    assert.ok(Object.values(by).every(Number.isInteger));
  });

  it("hands out the odd tokens left by rounding without losing or inventing any", () => {
    const o = clearAuction([bid("A", 0.03, 3), bid("B", 0.03, 3), bid("C", 0.03, 3)], 10, 0.01);
    assert.equal(o.sold, 9, "demand is 9 and the supply 10: all of it is filled");
    const o2 = clearAuction([bid("A", 0.03, 5), bid("B", 0.03, 5), bid("C", 0.03, 5)], 10, 0.01);
    assert.equal(o2.sold, 10);
    assert.deepEqual(o2.fills.map((f) => f.filled).sort(), [3, 3, 4]);
  });

  it("ignores bids under the reserve and never lets a bid pay more than it locked", () => {
    const o = clearAuction([bid("A", 0.05, 500_000), bid("Low", 0.005, 900_000)], 400_000, 0.01);
    assert.equal(o.belowReserve.length, 1);
    assert.equal(o.fills.find((f) => f.bid.id === "Low")!.filled, 0);
    for (const f of o.fills) assert.ok(f.refund >= -1e-9, `${f.bid.id} refund ${f.refund}`);
  });

  it("money in equals money out: what is locked is paid or refunded, to the cent", () => {
    const bids = [bid("A", 0.05, 400_000), bid("B", 0.04, 300_000), bid("C", 0.03, 300_000), bid("D", 0.02, 200_000)];
    const o = clearAuction(bids, 1_000_000, 0.01);
    near(o.fills.reduce((s, f) => s + f.locked, 0), o.raised + o.fills.reduce((s, f) => s + f.refund, 0));
  });

  it("refuses a launch with no supply or no reserve", () => {
    assert.throws(() => clearAuction([], 0, 0.01), /supply/);
    assert.throws(() => clearAuction([], 100, 0), /reserve/);
  });
});
