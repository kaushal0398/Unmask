/**
 * Deterministic integer-only auction engine (v1).
 *
 * All numeric inputs/outputs are decimal strings so JSON can carry values larger
 * than Number.MAX_SAFE_INTEGER without loss. `limitPrice` is payment-token
 * atomic units per one whole launched token. `quantity` and `supply` are in
 * launched-token atomic units. `tokenDecimals` converts between the two.
 *
 * Payment and maximum-lock calculations round UP to the next payment atomic
 * unit. This is conservative: a bidder is never under-collateralized because
 * of fractional payment-token atomic units.
 *
 * Marginal-tier pro-rata leftovers use lexicographic bid-id order in v1.
 * This is deterministic, but is NOT verifiable randomness. A later version
 * can replace it with an explicitly specified NEAR/OutLayer randomness source.
 */

export const AUCTION_CORE_VERSION = "1" as const;
export const MAX_BIDS = 10_000;
export const MAX_TOKEN_DECIMALS = 24;

export type ExactBid = {
  id: string;
  bidder: string;
  /** Payment-token atomic units per one whole launched token. */
  limitPrice: string;
  /** Launched-token atomic units. */
  quantity: string;
};

export type ExactAuctionInput = {
  version: typeof AUCTION_CORE_VERSION;
  auctionId: string;
  supply: string;
  reservePrice: string;
  tokenDecimals: number;
  bids: ExactBid[];
};

export type ExactFill = {
  bidId: string;
  bidder: string;
  limitPrice: string;
  requested: string;
  filled: string;
  /** Maximum collateral required for the full requested quantity. */
  locked: string;
  /** Amount due at the uniform clearing price. */
  payment: string;
  refund: string;
};

export type ExactAuctionOutcome = {
  version: typeof AUCTION_CORE_VERSION;
  auctionId: string;
  tokenDecimals: number;
  clearingPrice: string;
  supply: string;
  sold: string;
  unsold: string;
  totalRaised: string;
  totalLocked: string;
  totalRefunded: string;
  fills: ExactFill[];
};

const UINT = /^(0|[1-9][0-9]*)$/;

function parseUint(value: string, field: string, allowZero = false): bigint {
  if (typeof value !== "string" || !UINT.test(value)) {
    throw new Error(`${field} must be a canonical unsigned integer string`);
  }
  const parsed = BigInt(value);
  if (!allowZero && parsed === 0n) throw new Error(`${field} must be greater than zero`);
  return parsed;
}

function ceilDiv(numerator: bigint, denominator: bigint): bigint {
  if (denominator <= 0n) throw new Error("denominator must be positive");
  return numerator === 0n ? 0n : (numerator + denominator - 1n) / denominator;
}

function compareIds(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

export function validateAuctionInput(input: ExactAuctionInput): void {
  if (input.version !== AUCTION_CORE_VERSION) throw new Error("unsupported auction core version");
  if (!input.auctionId || input.auctionId.length > 128) throw new Error("auctionId is required and must be <= 128 chars");
  parseUint(input.supply, "supply");
  parseUint(input.reservePrice, "reservePrice");
  if (!Number.isInteger(input.tokenDecimals) || input.tokenDecimals < 0 || input.tokenDecimals > MAX_TOKEN_DECIMALS) {
    throw new Error(`tokenDecimals must be an integer from 0 to ${MAX_TOKEN_DECIMALS}`);
  }
  if (!Array.isArray(input.bids)) throw new Error("bids must be an array");
  if (input.bids.length > MAX_BIDS) throw new Error(`bids cannot exceed ${MAX_BIDS}`);

  const ids = new Set<string>();
  for (const [index, bid] of input.bids.entries()) {
    if (!bid.id || bid.id.length > 128) throw new Error(`bids[${index}].id is required and must be <= 128 chars`);
    if (!bid.bidder || bid.bidder.length > 128) throw new Error(`bids[${index}].bidder is required and must be <= 128 chars`);
    if (ids.has(bid.id)) throw new Error(`duplicate bid id: ${bid.id}`);
    ids.add(bid.id);
    parseUint(bid.limitPrice, `bids[${index}].limitPrice`);
    parseUint(bid.quantity, `bids[${index}].quantity`);
  }
}

/** Calculate a sealed-bid, uniform-price auction using integer arithmetic only. */
export function clearAuctionExact(input: ExactAuctionInput): ExactAuctionOutcome {
  validateAuctionInput(input);

  const supply = BigInt(input.supply);
  const reserve = BigInt(input.reservePrice);
  const tokenScale = 10n ** BigInt(input.tokenDecimals);
  const bids = input.bids.map((bid) => ({
    ...bid,
    limit: BigInt(bid.limitPrice),
    quantity: BigInt(bid.quantity),
  }));

  const eligible = bids
    .filter((bid) => bid.limit >= reserve)
    .sort((a, b) => (a.limit > b.limit ? -1 : a.limit < b.limit ? 1 : compareIds(a.id, b.id)));

  const totalEligibleDemand = eligible.reduce((sum, bid) => sum + bid.quantity, 0n);
  let clearingPrice = reserve;
  if (totalEligibleDemand >= supply) {
    let cumulative = 0n;
    for (const bid of eligible) {
      cumulative += bid.quantity;
      if (cumulative >= supply) {
        clearingPrice = bid.limit;
        break;
      }
    }
  }

  const allocations = new Map<string, bigint>();
  let remaining = supply;
  const strictlyAbove = eligible.filter((bid) => bid.limit > clearingPrice);
  for (const bid of strictlyAbove) {
    const fill = bid.quantity < remaining ? bid.quantity : remaining;
    allocations.set(bid.id, fill);
    remaining -= fill;
  }

  const marginal = eligible.filter((bid) => bid.limit === clearingPrice);
  const marginalDemand = marginal.reduce((sum, bid) => sum + bid.quantity, 0n);
  const marginalPot = remaining < marginalDemand ? remaining : marginalDemand;

  if (marginalPot > 0n && marginalDemand > 0n) {
    const shares = marginal.map((bid) => {
      const numerator = marginalPot * bid.quantity;
      return { bid, whole: numerator / marginalDemand, remainder: numerator % marginalDemand };
    });
    let distributed = 0n;
    for (const share of shares) {
      allocations.set(share.bid.id, share.whole);
      distributed += share.whole;
    }
    const remainderOrder = [...shares].sort((a, b) =>
      a.remainder > b.remainder ? -1 : a.remainder < b.remainder ? 1 : compareIds(a.bid.id, b.bid.id),
    );
    let crumbs = marginalPot - distributed;
    for (const share of remainderOrder) {
      if (crumbs === 0n) break;
      allocations.set(share.bid.id, (allocations.get(share.bid.id) ?? 0n) + 1n);
      crumbs -= 1n;
    }
    if (crumbs !== 0n) throw new Error("internal allocation invariant failed");
    remaining -= marginalPot;
  }

  const fills: ExactFill[] = bids.map((bid) => {
    const filled = allocations.get(bid.id) ?? 0n;
    const locked = ceilDiv(bid.limit * bid.quantity, tokenScale);
    const payment = ceilDiv(clearingPrice * filled, tokenScale);
    if (payment > locked) throw new Error(`payment exceeds locked amount for bid ${bid.id}`);
    return {
      bidId: bid.id,
      bidder: bid.bidder,
      limitPrice: bid.limit.toString(),
      requested: bid.quantity.toString(),
      filled: filled.toString(),
      locked: locked.toString(),
      payment: payment.toString(),
      refund: (locked - payment).toString(),
    };
  });

  const sold = fills.reduce((sum, fill) => sum + BigInt(fill.filled), 0n);
  const totalLocked = fills.reduce((sum, fill) => sum + BigInt(fill.locked), 0n);
  const totalRaised = fills.reduce((sum, fill) => sum + BigInt(fill.payment), 0n);
  const totalRefunded = fills.reduce((sum, fill) => sum + BigInt(fill.refund), 0n);

  if (sold > supply) throw new Error("internal invariant failed: sold exceeds supply");
  if (totalLocked !== totalRaised + totalRefunded) throw new Error("internal invariant failed: locked != paid + refunded");

  return {
    version: AUCTION_CORE_VERSION,
    auctionId: input.auctionId,
    tokenDecimals: input.tokenDecimals,
    clearingPrice: clearingPrice.toString(),
    supply: supply.toString(),
    sold: sold.toString(),
    unsold: (supply - sold).toString(),
    totalRaised: totalRaised.toString(),
    totalLocked: totalLocked.toString(),
    totalRefunded: totalRefunded.toString(),
    fills,
  };
}

/** Convert a human decimal string to an integer scaled by `decimals`, without floats. */
export function decimalToAtomic(value: string, decimals: number): string {
  if (!Number.isInteger(decimals) || decimals < 0 || decimals > MAX_TOKEN_DECIMALS) throw new Error("invalid decimals");
  if (!/^(0|[1-9][0-9]*)(\.[0-9]+)?$/.test(value)) throw new Error("amount must be a positive plain decimal string");
  const [whole, fraction = ""] = value.split(".");
  if (fraction.length > decimals) throw new Error(`amount has more than ${decimals} decimal places`);
  return (BigInt(whole!) * 10n ** BigInt(decimals) + BigInt((fraction + "0".repeat(decimals)).slice(0, decimals) || "0")).toString();
}
