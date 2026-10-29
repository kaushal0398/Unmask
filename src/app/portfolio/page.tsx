import type { Metadata } from "next";
import { PageHeader } from "@/components/page-header";
import { Container } from "@/components/ui";
import { PortfolioView, type Position } from "@/components/portfolio-view";
import { LAUNCHES, getLaunch, outcomeOf } from "@/lib/demo";

export const metadata: Metadata = { title: "My bids" };

/** The demo account's positions: one open, one won, one lost. The settled ones come from the real rule on the launch's bids. */
function positions(): Position[] {
  const out: Position[] = [];
  const bean = getLaunch("moonbean")!;
  out.push({ launchId: bean.id, name: bean.name, symbol: bean.symbol, emoji: bean.emoji, hue: bean.hue, status: "sealed-open", limit: 0.03, qty: 40_000, locked: 1_200, got: 0, paid: 0, refunded: 0 });
  for (const [id, who] of [["pixelpup", "dev.near"], ["saltlamp", "oli.near"]] as const) {
    const l = LAUNCHES.find((x) => x.id === id)!;
    const f = outcomeOf(l)!.fills.find((x) => x.bid.label === who)!;
    out.push({ launchId: l.id, name: l.name, symbol: l.symbol, emoji: l.emoji, hue: l.hue, status: f.filled > 0 ? "won" : "refunded", limit: f.bid.limit, qty: f.bid.qty, locked: f.locked, got: f.filled, paid: f.pays, refunded: f.refund });
  }
  return out;
}

export default function PortfolioPage() {
  return (
    <>
      <PageHeader eyebrow="My bids" title="Everything you locked, won and got back." demo>Connect the demo wallet to see an account with one open bid, one win and one loss.</PageHeader>
      <Container className="py-14 sm:py-20"><PortfolioView positions={positions()} /></Container>
    </>
  );
}
