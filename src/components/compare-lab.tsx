"use client";

import { useMemo, useState } from "react";
import { Card, Mono, cx } from "@/components/ui";
import type { Bid } from "@/lib/auction";
import { RACE_BIDS, RACE_RESERVE, RACE_SUPPLY } from "@/lib/demo";
import { usd } from "@/lib/format";
import { firstCome, sealed, type RaceSide, type Slice } from "@/lib/race";

const HUMANS = RACE_BIDS.filter((b) => !b.isBot);
const TINTS = ["#f4f4f5", "#d4d4d8", "#a1a1aa", "#e4e4e7", "#8b8b93", "#c4c4cc"];

function Bar({ side }: { side: RaceSide }) {
  let h = -1;
  return (
    <div className="flex h-12 w-full overflow-hidden border border-line-strong bg-black p-1" role="img" aria-label={`Bots hold ${Math.round(side.botShare * 100)} percent`}>
      {side.slices.map((s: Slice, i) => {
        if (s.kind === "human") h++;
        return (
          <div
            key={s.id}
            className="h-full transition-[width] duration-300"
            style={{
              width: `${s.share * 100}%`,
              background: s.kind === "bot" ? "var(--color-danger)" : s.kind === "unsold" ? "repeating-linear-gradient(135deg,#3a3a42 0 6px,transparent 6px 12px)" : TINTS[h % TINTS.length],
              borderRight: i < side.slices.length - 1 ? "2px solid #000" : undefined,
            }}
            title={`${s.label}: ${(s.share * 100).toFixed(0)}%`}
          />
        );
      })}
    </div>
  );
}

function Side({ title, tone, side }: { title: string; tone: "danger" | "seal"; side: RaceSide }) {
  const paid = side.slices.filter((s) => s.kind === "human" && s.avgPrice).map((s) => s.avgPrice!);
  return (
    <Card className={cx("p-6", tone === "danger" ? "border-danger/30" : "border-seal/35")}>
      <h3 className="font-semibold">{title}</h3>
      <div className="mt-5"><Bar side={side} /></div>
      <dl className="mt-6 grid grid-cols-3 gap-px border border-line bg-line text-center">
        <div className="bg-surface p-3"><dt className="text-[10px] uppercase tracking-wider text-faint">Bots hold</dt><dd className={cx("mt-1 font-mono text-xl font-semibold", side.botShare > 0 ? "text-danger" : "text-verified")}>{Math.round(side.botShare * 100)}%</dd></div>
        <div className="bg-surface p-3"><dt className="text-[10px] uppercase tracking-wider text-faint">Humans served</dt><dd className="mt-1 font-mono text-xl font-semibold">{side.humansServed}<span className="text-sm font-normal text-faint">/{side.humans}</span></dd></div>
        <div className="bg-surface p-3"><dt className="text-[10px] uppercase tracking-wider text-faint">Humans paid</dt><dd className="mt-1 font-mono text-sm font-semibold">{paid.length ? (Math.min(...paid) === Math.max(...paid) ? usd(paid[0]!) : `${usd(Math.min(...paid))}+`) : "none"}</dd></div>
      </dl>
    </Card>
  );
}

/** Two launches, the same buyers, and a dial for how many bot wallets are in the room. */
export function CompareLab() {
  const [bots, setBots] = useState(4);
  const [botLimit, setBotLimit] = useState(0.015);

  const { fc, sb } = useMemo(() => {
    const botBids: Bid[] = Array.from({ length: bots }, (_, i) => ({ id: `bot${i + 1}`, label: `sniper-${i + 1}.near`, limit: botLimit, qty: 150_000, isBot: true }));
    const bids = [...HUMANS, ...botBids];
    return { fc: firstCome(bids, RACE_SUPPLY, RACE_RESERVE, 0.06), sb: sealed(bids, RACE_SUPPLY, RACE_RESERVE) };
  }, [bots, botLimit]);

  return (
    <div>
      <Card className="grid gap-8 p-6 sm:grid-cols-2 sm:p-8">
        <label className="block">
          <span className="flex items-baseline justify-between text-sm"><span className="font-medium">Bot wallets in the room</span><Mono className="text-lg text-danger">{bots}</Mono></span>
          <input type="range" min={0} max={8} step={1} value={bots} onChange={(e) => setBots(Number(e.target.value))} className="mt-4 w-full accent-[#ff5c5c]" aria-label="Number of bot wallets" />
          <span className="mt-2 block text-xs text-faint">Each one asks for 15% of the supply.</span>
        </label>
        <label className="block">
          <span className="flex items-baseline justify-between text-sm"><span className="font-medium">What the bots will pay</span><Mono className="text-lg text-seal">{usd(botLimit)}</Mono></span>
          <input type="range" min={0.011} max={0.06} step={0.001} value={botLimit} onChange={(e) => setBotLimit(Number(e.target.value))} className="mt-4 w-full accent-[#8b7bff]" aria-label="Bot limit price" />
          <span className="mt-2 block text-xs text-faint">Raise it and the bots start to win the sealed launch too: they have to pay for it.</span>
        </label>
      </Card>
      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Side title="First-come launch" tone="danger" side={fc} />
        <Side title="Sealed-bid launch" tone="seal" side={sb} />
      </div>
      <p className="mt-5 max-w-3xl text-xs leading-relaxed text-faint">
        Illustration with the same buyers on both sides. First-come uses a simple rising price curve with the fastest buyers served first. The sealed side is the real auction rule. A bot that bids high enough does win sealed tokens, but it pays the same price as everyone and gains nothing from being fast.
      </p>
    </div>
  );
}
