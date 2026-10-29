import { LAUNCHES, outcomeOf } from "@/lib/demo";
import { usd } from "@/lib/format";

/** A slow, endless strip of launches. Pure CSS, so it costs nothing to run. */
export function Ticker() {
  const items = LAUNCHES.map((l) => ({
    key: l.id,
    emoji: l.emoji,
    text: `$${l.symbol}`,
    note: l.status === "settled" ? `cleared at ${usd(outcomeOf(l)?.price ?? l.reserve)}` : l.status === "open" ? `${l.bidCount} sealed bids` : "counting",
  }));
  const loop = [...items, ...items, ...items];
  return (
    <div className="relative overflow-hidden border-y border-line bg-black py-3" aria-hidden>
      <div className="flex w-max animate-[ticker_38s_linear_infinite] gap-10 whitespace-nowrap">
        {loop.map((it, i) => (
          <span key={`${it.key}-${i}`} className="flex items-center gap-2.5 text-sm text-muted">
            <span className="text-lg">{it.emoji}</span>
            <span className="font-mono font-semibold text-text">{it.text}</span>
            <span className="text-faint">{it.note}</span>
            <span className="text-faint/50">✦</span>
          </span>
        ))}
      </div>
      <div className="pointer-events-none absolute inset-y-0 left-0 w-24 bg-gradient-to-r from-black to-transparent" />
      <div className="pointer-events-none absolute inset-y-0 right-0 w-24 bg-gradient-to-l from-black to-transparent" />
    </div>
  );
}
