import type { Result } from "@/lib/api/types";
import { shortHash, tokens, usd } from "@/lib/format";

/** One bidder's outcome, in numbers a person can read at a glance and share. */
export type CardData = {
  launchId: string;
  symbol: string;
  bidder: string;
  status: "won" | "partly" | "lost";
  limit: number;
  qty: number;
  got: number;
  paid: number;
  refunded: number;
  /** What each token actually cost: paid / got. Null if they got none. */
  effectivePrice: number | null;
  clearingPrice: number;
  /** What the bidder would have paid at their own limit minus what they paid. Null if they got none. */
  savedVsLimit: number | null;
  agent: { signed: boolean } | null;
  mode: "dev" | "tee";
  resultHash: string;
};

const cents = (n: number) => Math.round(n * 1e8);

export function cardFor(result: Result, symbol: string, bidder: string): CardData | null {
  const a = result.allocations.find((x) => x.bidder === bidder);
  if (!a) return null;
  const got = a.filled;
  return {
    launchId: result.launchId,
    symbol,
    bidder,
    status: got <= 0 ? "lost" : got < a.qty ? "partly" : "won",
    limit: a.limit,
    qty: a.qty,
    got,
    paid: a.paid,
    refunded: a.refund,
    effectivePrice: got > 0 ? a.paid / got : null,
    clearingPrice: result.clearingPrice,
    savedVsLimit: got > 0 ? Math.max(0, (cents(a.limit) * got - cents(a.paid)) / 1e8) : null,
    agent: a.agent ?? null,
    mode: result.mode ?? "dev",
    resultHash: result.attestation.resultHash,
  };
}

export const STATUS_TEXT: Record<CardData["status"], string> = { won: "Won", partly: "Partly filled", lost: "Priced out" };

/** A line to paste into a post. Never includes anything sealed: only what the public result already shows. */
export function cardText(c: CardData): string {
  const head = c.got > 0 ? `I got ${tokens(c.got)} ${c.symbol} at an effective ${usd(c.effectivePrice ?? 0)} each` : `My bid for ${c.symbol} was priced out and fully refunded`;
  const save = c.savedVsLimit && c.savedVsLimit > 0 ? `, saving ${usd(c.savedVsLimit)} against my own limit` : "";
  const how = c.agent ? " (my agent bid inside rules I set)" : "";
  return `${head}${save}${how}. Everyone paid one clearing price, ${usd(c.clearingPrice)}. Sealed bids, checkable result. Unmask on NEAR.`;
}

const esc = (s: string) => s.replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch]!);

/** A 1200x630 image of the card, as SVG text. Flat colours only. */
export function cardSvg(c: CardData): string {
  const accent = c.status === "lost" ? "#8b8b95" : c.status === "partly" ? "#ffb547" : "#00ec97";
  const rows: Array<[string, string]> = [
    ["Paid", usd(c.paid)],
    ["Refunded", usd(c.refunded)],
    ["Effective price", c.effectivePrice === null ? "—" : usd(c.effectivePrice)],
    ["My limit", usd(c.limit)],
    ["Clearing price", usd(c.clearingPrice)],
  ];
  const big = c.got > 0 ? `${tokens(c.got)} ${c.symbol}` : "Priced out";
  const note = c.mode === "tee" ? "attested result" : "development result: not attested";
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630" font-family="ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, sans-serif">
<rect width="1200" height="630" fill="#000"/>
<rect x="24" y="24" width="1152" height="582" fill="none" stroke="#2a2a2a" stroke-width="2"/>
<rect x="24" y="24" width="14" height="582" fill="${accent}"/>
<path d="M70 86L88 80L106 86V99L94 111L88 106L82 111L70 99Z" fill="#fff"/>
<path d="M75 91L84 94V98L76 96Z" fill="#e501a5"/>
<text x="124" y="102" fill="#ededed" font-size="34" font-weight="700">Unmask</text>
<text x="1130" y="102" fill="${accent}" font-size="28" font-weight="700" text-anchor="end">${esc(STATUS_TEXT[c.status].toUpperCase())}</text>
<text x="70" y="250" fill="#ffffff" font-size="96" font-weight="700">${esc(big)}</text>
<text x="70" y="304" fill="#a9a9b3" font-size="30">${esc(c.bidder)}${c.agent ? " · agent bid inside signed rules" : ""}</text>
${rows.map(([k, v], i) => `<text x="70" y="${370 + i * 44}" fill="#8b8b95" font-size="26">${esc(k)}</text><text x="560" y="${370 + i * 44}" fill="#ededed" font-size="28" font-family="ui-monospace, SFMono-Regular, Menlo, monospace" text-anchor="end">${esc(v)}</text>`).join("\n")}
<text x="1130" y="250" fill="#a9a9b3" font-size="24" text-anchor="end">everyone paid one price</text>
<text x="1130" y="300" fill="${accent}" font-size="64" font-weight="700" text-anchor="end" font-family="ui-monospace, SFMono-Regular, Menlo, monospace">${esc(usd(c.clearingPrice))}</text>
<text x="70" y="586" fill="#8b8b95" font-size="22">${esc(note)} · result ${esc(shortHash(c.resultHash, 8, 6))}</text>
<text x="1130" y="586" fill="#8b8b95" font-size="22" text-anchor="end">Bid blind, win fair, check everything.</text>
</svg>`;
}
