"use client";

import { AnimatePresence, motion } from "motion/react";
import { Eye, EyeOff, RotateCcw } from "lucide-react";
import { useMemo, useState } from "react";
import type { Outcome } from "@/lib/auction";
import { Badge, Button, Card, Mono, cx } from "@/components/ui";
import { tokens, usd } from "@/lib/format";

const W = 760;
const H = 340;
const PAD = { l: 52, r: 16, t: 16, b: 34 };

/**
 * The sealed order book, opened. Bids stack left to right from the highest limit price, so the width is how many
 * tokens would be bought at that price or better. The supply line cuts the stack; the price where it cuts is the
 * clearing price, and everyone left of the line pays it.
 */
export function AuctionLadder({ outcome, symbol, startRevealed = false }: { outcome: Outcome; symbol: string; startRevealed?: boolean }) {
  const [revealed, setRevealed] = useState(startRevealed);
  const [pass, setPass] = useState(0);

  const rows = useMemo(() => [...outcome.fills].sort((a, b) => b.bid.limit - a.bid.limit || a.bid.id.localeCompare(b.bid.id)), [outcome]);
  const totalDemand = rows.reduce((s, r) => s + r.bid.qty, 0);
  const xMax = Math.max(totalDemand, outcome.supply) * 1.04;
  const yMax = Math.max(...rows.map((r) => r.bid.limit), outcome.price) * 1.18;
  const x = (q: number) => PAD.l + (q / xMax) * (W - PAD.l - PAD.r);
  const y = (p: number) => H - PAD.b - (p / yMax) * (H - PAD.t - PAD.b);

  const bars = rows.map((r, i) => {
    const x0 = rows.slice(0, i).reduce((s, p) => s + p.bid.qty, 0);
    return { r, i, x0, x1: x0 + r.bid.qty };
  });
  const yTicks = [0, 0.25, 0.5, 0.75, 1].map((t) => t * yMax);

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          {revealed ? <Badge tone="verified">bids opened</Badge> : <Badge tone="seal">bids sealed</Badge>}
          <span className="text-xs text-faint">{rows.length} bids</span>
        </div>
        <div className="flex gap-2">
          {revealed ? (
            <Button
              tone="ghost"
              onClick={() => {
                setRevealed(false);
                setPass((p) => p + 1);
              }}
            >
              <RotateCcw className="size-4" /> Seal again
            </Button>
          ) : (
            <Button tone="seal" onClick={() => setRevealed(true)}>
              <Eye className="size-4" /> Open the bids
            </Button>
          )}
        </div>
      </div>

      <dl className="mt-4 grid grid-cols-2 gap-px border border-line bg-line sm:grid-cols-4">
        {(revealed
          ? [
              ["Clearing price", usd(outcome.price), "text-price"],
              ["Sold", `${tokens(outcome.sold)} ${symbol}`, "text-verified"],
              ["Raised", usd(outcome.raised), "text-near"],
              ["Refunded", usd(outcome.fills.reduce((a, f) => a + f.refund, 0)), "text-muted"],
            ]
          : [
              ["Clearing price", "sealed", "text-seal-fg"],
              ["Sold", "sealed", "text-seal-fg"],
              ["Raised", "sealed", "text-seal-fg"],
              ["Bids", String(rows.length), "text-text"],
            ]
        ).map(([k, v, c]) => (
          <div key={k} className="bg-surface px-4 py-4">
            <dt className="text-[10px] uppercase tracking-wider text-faint">{k}</dt>
            <dd className={cx("mt-1 font-mono text-xl font-semibold tabular-nums", c)}>{v}</dd>
          </div>
        ))}
      </dl>

      <Card className="mt-4 overflow-hidden p-3 sm:p-5">
        <div className="relative">
          <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Sealed-bid order book">
            {yTicks.map((t) => (
              <g key={t}>
                <line x1={PAD.l} x2={W - PAD.r} y1={y(t)} y2={y(t)} stroke="rgb(255 255 255 / 0.06)" />
                <text x={PAD.l - 8} y={y(t) + 4} textAnchor="end" className="fill-[#8b8b95] font-mono text-[10px]">
                  {usd(t)}
                </text>
              </g>
            ))}
            <text x={W - PAD.r} y={H - 8} textAnchor="end" className="fill-[#8b8b95] text-[10px]">
              tokens bought at that price or better →
            </text>

            {bars.map(({ r, i, x0, x1 }) => {
              const supplyCut = Math.min(x1, outcome.supply);
              const winPart = r.filled > 0 ? Math.max(0, supplyCut - x0) : 0;
              const isBot = r.bid.isBot;
              const top = y(r.bid.limit);
              const base = y(0);
              return (
                <g key={`${r.bid.id}-${pass}`}>
                  <motion.rect
                    x={x(x0) + 1}
                    width={Math.max(0, x(x1) - x(x0) - 2)}
                    rx={0}
                    fill={revealed ? (isBot ? "#ff5c5c" : "#34343c") : "#e501a5"}
                    stroke="#000"
                    strokeWidth={1.5}
                    initial={false}
                    animate={{ y: revealed ? top : base - 46, height: revealed ? base - top : 46 }}
                    transition={{ delay: revealed ? i * 0.1 : 0, duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
                  />
                  {revealed && winPart > 0 && (
                    <motion.rect
                      x={x(x0) + 1}
                      width={Math.max(0, x(x0 + winPart) - x(x0) - 2)}
                      rx={0}
                      fill="#00ec97"
                      stroke="#000"
                      strokeWidth={1.5}
                      initial={{ y: base, height: 0 }}
                      animate={{ y: top, height: base - top }}
                      transition={{ delay: 0.3 + i * 0.1, duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
                    />
                  )}
                  {!revealed && (
                    <text x={(x(x0) + x(x1)) / 2} y={base - 18} textAnchor="middle" className="fill-black font-mono text-[12px] font-bold">
                      ••••
                    </text>
                  )}
                </g>
              );
            })}

            <AnimatePresence>
              {revealed && (
                <motion.g key={`line-${pass}`} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 + rows.length * 0.1, duration: 0.5 }}>
                  <line x1={PAD.l} x2={W - PAD.r} y1={y(outcome.price)} y2={y(outcome.price)} stroke="#ffb547" strokeWidth={2} strokeDasharray="6 4" />
                  <text x={W - PAD.r - 4} y={y(outcome.price) - 8} textAnchor="end" className="fill-[#ffb547] font-mono text-[12px] font-bold">
                    clearing price {usd(outcome.price)}
                  </text>
                  <line x1={x(outcome.supply)} x2={x(outcome.supply)} y1={PAD.t} y2={H - PAD.b} stroke="#38d5ff" strokeWidth={2} strokeDasharray="3 5" />
                  <text x={x(outcome.supply) + 6} y={PAD.t + 10} className="fill-[#38d5ff] font-mono text-[11px] font-bold">
                    supply {tokens(outcome.supply)}
                  </text>
                </motion.g>
              )}
            </AnimatePresence>
          </svg>
        </div>
        <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 border-t border-line pt-3 text-xs text-muted">
          <span className="flex items-center gap-1.5"><span className="size-3 bg-verified" /> filled, pays the clearing price</span>
          <span className="flex items-center gap-1.5"><span className="size-3 bg-[#34343c]" /> priced out, refunded</span>
          <span className="flex items-center gap-1.5"><span className="size-3 bg-danger" /> a bot cluster</span>
          <span className="flex items-center gap-1.5"><span className="h-0.5 w-4 bg-price" /> clearing price</span>
          <span className="flex items-center gap-1.5"><span className="h-0.5 w-4 bg-near" /> supply</span>
        </div>
      </Card>

      <div className="mt-4 overflow-x-auto" tabIndex={0} role="region" aria-label="Scrollable chart">
        <table className="w-full min-w-[560px] text-sm">
          <thead>
            <tr className="border-b border-line text-left text-xs uppercase tracking-wider text-faint">
              <th className="py-2.5 pr-3 font-medium">Bidder</th>
              <th className="px-3 py-2.5 text-right font-medium">Limit</th>
              <th className="px-3 py-2.5 text-right font-medium">Wanted</th>
              <th className="px-3 py-2.5 text-right font-medium">Got</th>
              <th className="px-3 py-2.5 text-right font-medium">Paid</th>
              <th className="py-2.5 pl-3 text-right font-medium">Refunded</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.bid.id} className={cx("border-b border-line/60", revealed && r.bid.isBot && "bg-danger/10", revealed && !r.bid.isBot && r.filled > 0 && "bg-verified/5")}>
                <td className="py-2.5 pr-3">
                  <span className="font-mono text-[13px]">{revealed ? r.bid.label : "•••••••"}</span>
                  {revealed && r.bid.isBot && <Badge tone="danger" className="ml-2 px-2 py-0.5">bot</Badge>}
                </td>
                <td className="px-3 py-2.5 text-right"><Mono className={revealed ? "" : "text-seal-fg"}>{revealed ? usd(r.bid.limit) : "••••"}</Mono></td>
                <td className="px-3 py-2.5 text-right"><Mono className={revealed ? "" : "text-seal-fg"}>{revealed ? tokens(r.bid.qty) : "••••"}</Mono></td>
                <td className={cx("px-3 py-2.5 text-right", revealed && r.filled > 0 && "text-verified")}><Mono>{revealed ? tokens(r.filled) : "••••"}</Mono></td>
                <td className="px-3 py-2.5 text-right"><Mono>{revealed ? usd(r.pays) : "••••"}</Mono></td>
                <td className="py-2.5 pl-3 text-right"><Mono className="text-muted">{revealed ? usd(r.refund) : "••••"}</Mono></td>
              </tr>
            ))}
          </tbody>
          {revealed && (
            <tfoot>
              <tr className="text-sm font-medium">
                <td className="py-3 pr-3" colSpan={3}>
                  <EyeOff className="mr-2 inline size-3.5 text-faint" />
                  {tokens(outcome.sold)} {symbol} sold at one price
                </td>
                <td className="px-3 py-3 text-right"><Mono className="text-verified">{tokens(outcome.sold)}</Mono></td>
                <td className="px-3 py-3 text-right"><Mono className="text-verified">{usd(outcome.raised)}</Mono></td>
                <td className="py-3 pl-3 text-right"><Mono className="text-muted">{usd(outcome.fills.reduce((s, f) => s + f.refund, 0))}</Mono></td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
}
