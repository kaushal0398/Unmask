/**
 * The sealed-bid, uniform-price auction the launch runs, for the screens to show. The enclave runs the real one;
 * this is the same rule (docs/what-we-are-building.md, section 4) so what the pages display is computed, not
 * invented.
 *
 *  - Sort bids by limit price, highest first (ties by id, so the result is repeatable).
 *  - Fill in that order until the supply is sold. The clearing price is the limit of the last bid filled, at
 *    least in part. If demand at or above the reserve is short of the supply, the price is the reserve.
 *  - Everyone filled pays the clearing price, not their own limit.
 *  - Bids at the clearing price share what is left pro-rata (whole tokens, largest remainder, then by id).
 *  - A bid below the clearing price wins nothing and is refunded in full.
 */

export type Bid = { id: string; label: string; limit: number; qty: number; isBot?: boolean };

export type Fill = {
  bid: Bid;
  filled: number;
  /** What they pay: filled × the clearing price. */
  pays: number;
  /** What they locked: limit × quantity, the most they could owe. */
  locked: number;
  /** What goes back to them. */
  refund: number;
};

export type Outcome = {
  price: number;
  supply: number;
  reserve: number;
  sold: number;
  unsold: number;
  raised: number;
  fills: Fill[];
  /** Bids that came in below the reserve, and so were never in the auction. */
  belowReserve: Bid[];
};

const byLimitThenId = (a: Bid, b: Bid) => b.limit - a.limit || a.id.localeCompare(b.id);

export function clearAuction(bids: Bid[], supply: number, reserve: number): Outcome {
  if (supply <= 0) throw new Error("the supply must be more than zero");
  if (reserve <= 0) throw new Error("the reserve price must be more than zero");
  const inPlay = bids.filter((b) => b.limit >= reserve && b.qty > 0).sort(byLimitThenId);
  const belowReserve = bids.filter((b) => b.limit < reserve || b.qty <= 0);

  // Walk down from the highest limit until the supply is covered.
  let cumulative = 0;
  let price = reserve;
  for (const b of inPlay) {
    cumulative += b.qty;
    if (cumulative >= supply) {
      price = b.limit;
      break;
    }
  }

  const filledQty = new Map<string, number>();
  let remaining = supply;
  const above = inPlay.filter((b) => b.limit > price);
  for (const b of above) {
    const q = Math.min(b.qty, remaining);
    filledQty.set(b.id, q);
    remaining -= q;
  }
  // The bids at the clearing price share what is left, pro-rata.
  const at = inPlay.filter((b) => b.limit === price);
  const demandAt = at.reduce((s, b) => s + b.qty, 0);
  if (remaining > 0 && demandAt > 0) {
    const pot = Math.min(remaining, demandAt);
    const shares = at.map((b) => ({ b, exact: (pot * b.qty) / demandAt }));
    let given = 0;
    for (const s of shares) {
      const whole = Math.floor(s.exact);
      filledQty.set(s.b.id, whole);
      given += whole;
    }
    // Largest remainder first; ties by id (the enclave uses verifiable randomness for these crumbs).
    const order = [...shares].sort((x, y) => y.exact - Math.floor(y.exact) - (x.exact - Math.floor(x.exact)) || x.b.id.localeCompare(y.b.id));
    for (let i = 0; given < pot && i < order.length; i++, given++) {
      const id = order[i]!.b.id;
      filledQty.set(id, (filledQty.get(id) ?? 0) + 1);
    }
  }

  const fills: Fill[] = [...inPlay, ...belowReserve].map((bid) => {
    const filled = filledQty.get(bid.id) ?? 0;
    const locked = bid.limit * bid.qty;
    const pays = filled * price;
    return { bid, filled, pays, locked, refund: locked - pays };
  });
  const sold = fills.reduce((s, f) => s + f.filled, 0);
  return { price, supply, reserve, sold, unsold: supply - sold, raised: fills.reduce((s, f) => s + f.pays, 0), fills, belowReserve };
}
