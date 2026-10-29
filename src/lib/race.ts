import { clearAuction, type Bid, type Outcome } from "@/lib/auction";

/**
 * The same bids in two kinds of launch, for the landing page's race.
 *
 * First-come is an illustration: a price that rises along a straight line as tokens are sold, with buyers served in
 * the order they arrive. Bot clusters are fastest, so they go first, and they buy whatever they want because they
 * mean to sell into the next buyers. Everyone else buys only while the price is at or under their limit.
 *
 * Sealed is not an illustration: it is the auction rule itself (`clearAuction`).
 */

export type Slice = { id: string; label: string; share: number; kind: "bot" | "human" | "unsold"; avgPrice: number | null };

export type RaceSide = { slices: Slice[]; botShare: number; humansServed: number; humans: number; unsoldShare: number; finalPrice: number };

export function firstCome(bids: Bid[], supply: number, startPrice: number, endPrice: number): RaceSide {
  const order = [...bids.filter((b) => b.isBot), ...bids.filter((b) => !b.isBot)];
  const priceAt = (sold: number) => startPrice + ((endPrice - startPrice) * sold) / supply;
  let sold = 0;
  const slices: Slice[] = [];
  for (const b of order) {
    const room = supply - sold;
    let q = Math.min(b.qty, room);
    if (!b.isBot) {
      const limitSold = supply * ((b.limit - startPrice) / (endPrice - startPrice));
      q = Math.min(q, Math.max(0, limitSold - sold));
    }
    q = Math.floor(q);
    slices.push({ id: b.id, label: b.label, share: q / supply, kind: b.isBot ? "bot" : "human", avgPrice: q > 0 ? priceAt(sold + q / 2) : null });
    sold += q;
  }
  const humans = bids.filter((b) => !b.isBot).length;
  if (sold < supply) slices.push({ id: "unsold", label: "unsold", share: (supply - sold) / supply, kind: "unsold", avgPrice: null });
  return {
    slices: slices.filter((s) => s.share > 0),
    botShare: slices.filter((s) => s.kind === "bot").reduce((a, s) => a + s.share, 0),
    humansServed: slices.filter((s) => s.kind === "human" && s.share > 0).length,
    humans,
    unsoldShare: (supply - sold) / supply,
    finalPrice: priceAt(sold),
  };
}

export function sealed(bids: Bid[], supply: number, reserve: number): RaceSide & { outcome: Outcome } {
  const outcome = clearAuction(bids, supply, reserve);
  const slices: Slice[] = outcome.fills
    .filter((f) => f.filled > 0)
    .sort((a, b) => b.bid.limit - a.bid.limit || a.bid.id.localeCompare(b.bid.id))
    .map((f) => ({ id: f.bid.id, label: f.bid.label, share: f.filled / supply, kind: f.bid.isBot ? ("bot" as const) : ("human" as const), avgPrice: outcome.price }));
  if (outcome.unsold > 0) slices.push({ id: "unsold", label: "unsold", share: outcome.unsold / supply, kind: "unsold", avgPrice: null });
  return {
    outcome,
    slices,
    botShare: slices.filter((s) => s.kind === "bot").reduce((a, s) => a + s.share, 0),
    humansServed: outcome.fills.filter((f) => !f.bid.isBot && f.filled > 0).length,
    humans: bids.filter((b) => !b.isBot).length,
    unsoldShare: outcome.unsold / supply,
    finalPrice: outcome.price,
  };
}
