"use client";

import { motion } from "motion/react";
import { RotateCcw } from "lucide-react";
import { useMemo, useState } from "react";
import { AnimatedNumber } from "@/components/animated-number";
import { Badge, Button, Card, Mono, cx } from "@/components/ui";
import { RACE_BIDS, RACE_RESERVE, RACE_SUPPLY } from "@/lib/demo";
import { usd } from "@/lib/format";
import { firstCome, sealed, type RaceSide, type Slice } from "@/lib/race";

const HUMAN_TINTS = ["#f4f4f5", "#d4d4d8", "#a1a1aa", "#e4e4e7", "#8b8b93", "#c4c4cc"];

function sliceColor(s: Slice, humanIndex: number) {
  if (s.kind === "bot") return "var(--color-danger)";
  if (s.kind === "unsold") return "transparent";
  return HUMAN_TINTS[humanIndex % HUMAN_TINTS.length]!;
}

/** The supply as one bar, filled slice by slice in the order the tokens went. */
function SupplyBar({ side, tone, base }: { side: RaceSide; tone: "danger" | "seal"; base: number }) {
  let human = -1;
  return (
    <div>
      <div className="flex h-14 w-full overflow-hidden rounded-none border border-line-strong bg-black p-1 sm:h-16" role="img" aria-label={`Supply split: bots hold ${Math.round(side.botShare * 100)} percent`}>
        {side.slices.map((s, i) => {
          if (s.kind === "human") human++;
          const unsold = s.kind === "unsold";
          return (
            <motion.div
              key={s.id}
              className={cx("relative h-full overflow-hidden", i === 0 ? "" : "", i === side.slices.length - 1 ? "" : "")}
              style={{ background: sliceColor(s, human), borderRight: i < side.slices.length - 1 ? "2px solid #000" : undefined }}
              initial={{ width: 0, opacity: 0.4 }}
              whileInView={{ width: `${s.share * 100}%`, opacity: 1 }}
              viewport={{ once: true, amount: 0.5 }}
              transition={{ delay: base + i * 0.28, duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
              title={`${s.label}: ${(s.share * 100).toFixed(0)}%${s.avgPrice ? ` at about ${usd(s.avgPrice)}` : ""}`}
            >
              {unsold && <div className="absolute inset-0 opacity-50" style={{ backgroundImage: "repeating-linear-gradient(135deg, #3a3a42 0 6px, transparent 6px 12px)" }} />}
              {s.share >= 0.1 && !unsold && (
                <span className={cx("absolute inset-x-1.5 bottom-1 truncate text-[10px] font-medium", s.kind === "bot" ? "text-black/80" : "text-black/70")}>{s.label.replace(".near", "")}</span>
              )}
            </motion.div>
          );
        })}
      </div>
      <div className="mt-2 flex justify-between text-[11px] text-faint">
        <span>first token</span>
        <span className={tone === "danger" ? "text-danger/80" : "text-seal/80"}>{tone === "danger" ? "bought in the order people arrive" : "split by price, never by arrival"}</span>
        <span>last token</span>
      </div>
    </div>
  );
}

function Panel({ title, tone, line, side, base, children }: { title: string; tone: "danger" | "seal"; line: string; side: RaceSide; base: number; children: React.ReactNode }) {
  const avgHuman = side.slices.filter((s) => s.kind === "human" && s.avgPrice).map((s) => s.avgPrice!);
  const priceText = avgHuman.length ? (Math.min(...avgHuman) === Math.max(...avgHuman) ? usd(avgHuman[0]!) : `${usd(Math.min(...avgHuman))} to ${usd(Math.max(...avgHuman))}`) : "no one";
  return (
    <Card className={cx("relative overflow-hidden p-5 sm:p-6", tone === "danger" ? "border-danger/20" : "border-seal/25")}>
      <div className={cx("pointer-events-none absolute inset-x-0 -top-24 h-48 blur-3xl", tone === "danger" ? "bg-danger/10" : "bg-seal/10")} />
      <div className="relative">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-lg font-semibold tracking-tight">{title}</h3>
          <Badge tone={tone === "danger" ? "danger" : "seal"}>{line}</Badge>
        </div>
        <div className="mt-6">
          <SupplyBar side={side} tone={tone} base={base} />
        </div>
        <dl className="mt-6 grid grid-cols-3 gap-3">
          <div>
            <dt className="text-xs text-faint">Bots hold</dt>
            <dd className={cx("mt-1 text-2xl font-semibold tabular-nums sm:text-3xl", side.botShare > 0 ? "text-danger" : "text-verified")}>
              <AnimatedNumber to={side.botShare * 100} delay={base + 0.6} format={(n) => `${Math.round(n)}%`} />
            </dd>
          </div>
          <div>
            <dt className="text-xs text-faint">Humans served</dt>
            <dd className="mt-1 text-2xl font-semibold tabular-nums sm:text-3xl">
              <AnimatedNumber to={side.humansServed} delay={base + 0.6} />
              <span className="text-base font-normal text-faint"> of {side.humans}</span>
            </dd>
          </div>
          <div>
            <dt className="text-xs text-faint">Humans paid</dt>
            <dd className="mt-1 text-base font-semibold leading-snug tabular-nums sm:text-lg">{priceText}</dd>
          </div>
        </dl>
        <ul className="mt-6 space-y-2 border-t border-line pt-5 text-sm text-muted">{children}</ul>
      </div>
    </Card>
  );
}

const Step = ({ delay, children }: { delay: number; children: React.ReactNode }) => (
  <motion.li initial={{ opacity: 0, x: -8 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true, amount: 0.8 }} transition={{ delay, duration: 0.4 }} className="flex gap-2.5">
    <span className="mt-2 size-1 shrink-0 rounded-none bg-faint" />
    <span>{children}</span>
  </motion.li>
);

/** Ten bids, two launches. The point of the product, in one picture. */
export function RaceDemo() {
  const [run, setRun] = useState(0);
  const { fc, sb } = useMemo(() => ({ fc: firstCome(RACE_BIDS, RACE_SUPPLY, RACE_RESERVE, 0.06), sb: sealed(RACE_BIDS, RACE_SUPPLY, RACE_RESERVE) }), []);

  return (
    <div>
      <div key={run} className="grid gap-5 lg:grid-cols-2">
        <Panel title="A first-come launch" tone="danger" line="the fastest wins" side={fc} base={0.1}>
          <Step delay={0.1}>Four bot wallets buy in the first block, before anyone has opened the page.</Step>
          <Step delay={0.9}>The price climbs as they buy. People who arrive next pay more for less.</Step>
          <Step delay={1.7}>
            Only {fc.humansServed} of {fc.humans} people got in. The bots hold {Math.round(fc.botShare * 100)}% and can sell into them.
          </Step>
        </Panel>
        <Panel title="A sealed-bid launch" tone="seal" line="order does not matter" side={sb} base={1.2}>
          <Step delay={1.2}>The same ten bids go in sealed. Nobody, the creator included, sees an amount.</Step>
          <Step delay={2.0}>At the close the enclave finds one price that sells the supply: <Mono className="text-text">{usd(sb.finalPrice)}</Mono>.</Step>
          <Step delay={2.8}>The bots had bid low, hoping for a cheap start. They win nothing and are refunded. {sb.humansServed} people are served at the same price.</Step>
        </Panel>
      </div>
      <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-2xl text-xs leading-relaxed text-faint">
          Illustration, same ten bids on both sides. The first-come side uses a simple rising price curve with the fastest buyers served first. The sealed side is the real auction rule, run on those bids.
        </p>
        <Button tone="ghost" onClick={() => setRun((r) => r + 1)}>
          <RotateCcw className="size-4" /> Replay
        </Button>
      </div>
    </div>
  );
}
