"use client";

import { motion } from "motion/react";
import Link from "next/link";
import { Countdown } from "@/components/countdown";
import { cx } from "@/components/ui";
import { outcomeOf, type Launch, type LaunchStatus } from "@/lib/demo";
import { compact, usd } from "@/lib/format";

const sticker: Record<LaunchStatus, { text: string; cls: string }> = {
  open: { text: "SEALED BIDS OPEN", cls: "bg-seal text-black" },
  sealed: { text: "COUNTING…", cls: "bg-white text-black" },
  settled: { text: "SETTLED ✓", cls: "bg-verified text-black" },
};

export function StatusBadge({ status }: { status: LaunchStatus }) {
  const s = sticker[status];
  return <span className={cx("inline-block -rotate-3 rounded-none px-2 py-1 text-[10px] font-extrabold tracking-wider shadow-[0_2px_0_rgb(0_0_0/0.5)]", s.cls)}>{s.text}</span>;
}

/**
 * A meme card: the token's colour fills the top, its mascot bobs about, and the status is a sticker slapped on
 * the corner. It tilts toward the cursor. The numbers underneath stay plain, because they are the point.
 */
export function LaunchCard({ launch, index = 0 }: { launch: Launch; index?: number }) {
  const outcome = outcomeOf(launch);
  const h = launch.hue;
  const tilt = index % 2 === 0 ? -1.2 : 1.2;

  return (
    <motion.div initial={{ opacity: 0, y: 18, rotate: tilt }} whileInView={{ opacity: 1, y: 0, rotate: 0 }} viewport={{ once: true, amount: 0.3 }} transition={{ delay: (index % 3) * 0.08, duration: 0.5 }} whileHover={{ y: -5, x: -3, rotate: tilt * 1.2 }} className="h-full">
      <Link href={`/launches/${launch.id}`} className="group relative block h-full overflow-hidden rounded-none border bg-surface transition-shadow duration-200" style={{ borderColor: `hsl(${h} 80% 60% / 0.45)`, boxShadow: `7px 7px 0 hsl(${h} 75% 45% / 0.32), 0 30px 60px -28px hsl(${h} 90% 55% / 0.6), inset 0 1px 0 rgb(255 255 255 / 0.06)` }}>
        <div className="relative h-36 overflow-hidden" style={{ background: `radial-gradient(120% 140% at 20% 0%, hsl(${h} 95% 62%), hsl(${h} 80% 38%) 55%, hsl(${(h + 40) % 360} 70% 14%))` }}>
          <div className="absolute inset-0 opacity-30 mix-blend-overlay" style={{ backgroundImage: "radial-gradient(rgb(255 255 255 / 0.5) 1px, transparent 1px)", backgroundSize: "14px 14px" }} />
          <motion.span aria-hidden className="absolute -bottom-3 right-3 select-none text-[104px] leading-none drop-shadow-[0_10px_20px_rgb(0_0_0/0.45)]" animate={{ rotate: [-6, 6, -6], y: [0, -6, 0] }} transition={{ repeat: Infinity, duration: 5 + index * 0.6, ease: "easeInOut" }}>
            {launch.emoji}
          </motion.span>
          <div className="absolute left-4 top-4"><StatusBadge status={launch.status} /></div>
          <span className="absolute bottom-4 left-4 rounded-none border border-white/20 bg-black/60 px-3 py-1 font-mono text-xs font-semibold backdrop-blur">${launch.symbol}</span>
          <span className="absolute right-4 top-4 font-mono text-[10px] font-semibold tracking-widest text-black/55">No. {String(index + 1).padStart(3, "0")}</span>
        </div>
        <div className="p-5">
          <h3 className="text-xl font-semibold tracking-tight">{launch.name}</h3>
          <p className="mt-1.5 line-clamp-2 min-h-10 text-sm leading-relaxed text-muted">{launch.tagline}</p>
          {launch.status === "open" && launch.closesInMs !== undefined && (
            <div className="mt-4 flex items-center justify-between rounded-none border border-seal/25 bg-seal/5 px-3.5 py-2.5">
              <span className="text-xs text-seal">closes in</span>
              <Countdown closesInMs={launch.closesInMs} size="sm" className="font-semibold text-seal" />
            </div>
          )}
          <dl className="mt-4 grid grid-cols-3 gap-px border border-line bg-line text-center">
            {[
              ["Supply", compact(launch.supply)],
              [outcome ? "Cleared" : "Reserve", usd(outcome ? outcome.price : launch.reserve)],
              ["Bids", launch.bidCount.toLocaleString("en-US")],
            ].map(([k, v]) => (
              <div key={k} className="bg-surface px-2 py-3">
                <dt className="text-[10px] uppercase tracking-wider text-faint">{k}</dt>
                <dd className="mt-0.5 font-mono text-sm font-medium tabular-nums">{v}</dd>
              </div>
            ))}
          </dl>
        </div>
      </Link>
    </motion.div>
  );
}
