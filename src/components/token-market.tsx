import { Card, Stat } from "@/components/ui";
import { compact, tokens, usd } from "@/lib/format";

type Bid = { limit: number; qty: number };

/**
 * Market cap and the demand curve for an auction. There is no trading yet, so there is no price history to chart:
 * this shows what the auction itself produced. Market cap here is price x total supply (fully diluted).
 */
export function TokenMarket({ symbol, supply, reserve, price, raised, bids }: {
  symbol: string; supply: number; reserve: number; price?: number; raised?: number; bids?: Bid[];
}) {
  const settled = price !== undefined && price > 0;
  const W = 640, H = 240, P = { l: 56, r: 16, t: 16, b: 32 };

  // Demand at price p = tokens wanted by bids whose limit is >= p (a step curve, falling as price rises).
  const pts = (bids ?? []).filter((b) => b.qty > 0 && b.limit > 0);
  const prices = [...new Set(pts.map((b) => b.limit))].sort((a, b) => a - b);
  const demandAt = (p: number) => pts.filter((b) => b.limit >= p).reduce((s, b) => s + b.qty, 0);
  const maxP = Math.max(...prices, price ?? 0, reserve) * 1.1 || 1;
  const maxQ = Math.max(supply, ...(prices.length ? [demandAt(prices[0]!)] : [0])) * 1.05;
  const x = (q: number) => P.l + (q / maxQ) * (W - P.l - P.r);
  const y = (p: number) => H - P.b - (p / maxP) * (H - P.t - P.b);

  let d = "";
  if (prices.length) {
    d = `M ${x(demandAt(prices[0]!))} ${y(0)}`;
    for (const p of prices) d += ` L ${x(demandAt(p))} ${y(p)} L ${x(demandAt(p + 1e-12))} ${y(p)}`;
  }
  const mcap = (p: number) => `${usd(p * supply, { compact: true })}`;

  return (
    <Card className="p-6 sm:p-8">
      <h2 className="text-lg font-semibold">Market</h2>
      <dl className="mt-4 grid grid-cols-2 gap-5 sm:grid-cols-4">
        <Stat label="Market cap at reserve" value={mcap(reserve)} hint={`${usd(reserve)} × ${compact(supply)}`} />
        <Stat label="Market cap at clearing" value={settled ? mcap(price!) : "—"} hint={settled ? `${usd(price!)} × ${compact(supply)}` : "after settlement"} tone={settled ? "verified" : undefined} />
        <Stat label="Raised" value={raised !== undefined ? usd(raised, { compact: true }) : "—"} />
        <Stat label="Supply" value={compact(supply)} hint={`${tokens(supply)} ${symbol}`} />
      </dl>

      {settled && prices.length > 0 ? (
        <>
          <svg viewBox={`0 0 ${W} ${H}`} className="mt-6 w-full" role="img" aria-label="Demand curve: tokens wanted at each price, with the clearing price marked">
            <line x1={P.l} y1={y(0)} x2={W - P.r} y2={y(0)} stroke="currentColor" className="text-line-strong" />
            <line x1={P.l} y1={P.t} x2={P.l} y2={y(0)} stroke="currentColor" className="text-line-strong" />
            <line x1={x(supply)} y1={P.t} x2={x(supply)} y2={y(0)} stroke="currentColor" strokeDasharray="4 4" className="text-faint" />
            <text x={x(supply)} y={P.t + 10} textAnchor="end" className="fill-current text-faint" fontSize="10">supply</text>
            <path d={d} fill="none" stroke="currentColor" strokeWidth="2" className="text-seal-fg" />
            <line x1={P.l} y1={y(price!)} x2={W - P.r} y2={y(price!)} stroke="currentColor" strokeDasharray="5 4" className="text-verified" />
            <text x={W - P.r} y={y(price!) - 5} textAnchor="end" className="fill-current text-verified" fontSize="11">clears at {usd(price!)} · {mcap(price!)} market cap</text>
            <text x={P.l - 6} y={y(maxP / 1.1) + 4} textAnchor="end" className="fill-current text-faint" fontSize="10">{usd(maxP / 1.1)}</text>
            <text x={P.l - 6} y={y(0) + 4} textAnchor="end" className="fill-current text-faint" fontSize="10">$0</text>
            <text x={(W + P.l) / 2} y={H - 6} textAnchor="middle" className="fill-current text-faint" fontSize="10">tokens wanted at or above each price →</text>
          </svg>
          <p className="mt-2 text-xs text-faint">Built from the revealed bids. Not a trading chart: there is no secondary market or price history yet.</p>
        </>
      ) : (
        <p className="mt-5 text-sm text-muted">The demand curve appears after settlement, when the sealed bids are opened. While bidding is open nobody can see it, by design.</p>
      )}
    </Card>
  );
}
