/**
 * Number-based presentation adapter retained for the existing demo UI.
 * Production/protocol code must call clearAuctionExact from auction-core.ts
 * and must pass atomic-unit integer strings. This adapter deliberately accepts
 * only safe integer quantities and prices representable to 8 decimal places.
 */
import { clearAuctionExact, decimalToAtomic } from "@/lib/auction-core";

export type Bid = { id: string; label: string; limit: number; qty: number; isBot?: boolean };
export type Fill = { bid: Bid; filled: number; pays: number; locked: number; refund: number };
export type Outcome = {
  price: number;
  supply: number;
  reserve: number;
  sold: number;
  unsold: number;
  raised: number;
  fills: Fill[];
  belowReserve: Bid[];
};

const DEMO_PRICE_DECIMALS = 8;
const DEMO_PRICE_SCALE = 10 ** DEMO_PRICE_DECIMALS;

function safeWhole(value: number, field: string): string {
  if (!Number.isSafeInteger(value) || value <= 0) throw new Error(`${field} must be a positive safe integer`);
  return String(value);
}

function scaledDemoPrice(value: number, field: string): string {
  if (!Number.isFinite(value) || value <= 0) throw new Error(`${field} must be a positive finite number`);
  // Number#toString gives the shortest decimal that round-trips to the supplied
  // JS number. Convert that decimal string without multiplying floats.
  const atomic = decimalToAtomic(value.toString(), DEMO_PRICE_DECIMALS);
  if (Number(atomic) / DEMO_PRICE_SCALE !== value) throw new Error(`${field} supports at most ${DEMO_PRICE_DECIMALS} decimal places`);
  return atomic;
}

export function clearAuction(bids: Bid[], supply: number, reserve: number): Outcome {
  const exact = clearAuctionExact({
    version: "1",
    auctionId: "legacy-ui-demo",
    supply: safeWhole(supply, "supply"),
    reservePrice: scaledDemoPrice(reserve, "reserve"),
    tokenDecimals: 0,
    bids: bids.map((bid) => ({
      id: bid.id,
      bidder: bid.label,
      limitPrice: scaledDemoPrice(bid.limit, `bid ${bid.id} limit`),
      quantity: safeWhole(bid.qty, `bid ${bid.id} quantity`),
    })),
  });
  const fromAtomic = (value: string) => {
    const integer = BigInt(value);
    if (integer > BigInt(Number.MAX_SAFE_INTEGER)) throw new Error("demo adapter amount exceeds safe display range; use the exact core API");
    return Number(integer) / DEMO_PRICE_SCALE;
  };
  const fills: Fill[] = exact.fills.map((fill, index) => ({
    bid: bids[index]!,
    filled: Number(fill.filled),
    pays: fromAtomic(fill.payment),
    locked: fromAtomic(fill.locked),
    refund: fromAtomic(fill.refund),
  }));
  return {
    price: fromAtomic(exact.clearingPrice),
    supply,
    reserve,
    sold: Number(exact.sold),
    unsold: Number(exact.unsold),
    raised: fromAtomic(exact.totalRaised),
    fills,
    belowReserve: bids.filter((bid) => bid.limit < reserve),
  };
}
