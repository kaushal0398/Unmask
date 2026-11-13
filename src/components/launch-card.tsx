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
    <motion.div initial={{ opacity: 0, y: 18, rotate: tilt }} whileInView={{ opacity: 1, y: 0, rotate: 0 }} viewport={{ once: true, amount: 0.3 }} transition={{ delay: (index % 3) * 0.08, duration: 0.5 }} whileHover={{ y: -4, x: -4 }} className="h-full">
      <Link
        href={`/launches/${launch.id}`}
        className="group relative block h-full overflow-hidden rounded-none border-2 bg-surface transition-transform duration-200"
        style={{ borderColor: `hsl(${h} 85% 60%)`, boxShadow: `8px 8px 0 hsl(${h} 85% 60% / 0.35)` }}
      >
        {/* Solid colour header: flat, bright, no gradient */}
        <div className="relative h-40 overflow-hidden" style={{ background: `hsl(${h} 90% 62%)` }}>
          {launch.image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={launch.image} alt="" className="absolute inset-0 size-full object-cover" />
          ) : (
            <motion.span aria-hidden className="absolute -bottom-2 right-4 select-none text-[112px] leading-none" animate={{ rotate: [-6, 6, -6], y: [0, -6, 0] }} transition={{ repeat: Infinity, duration: 5 + index * 0.6, ease: "easeInOut" }}>
              {launch.emoji}
            </motion.span>
          )}
          <div className="absolute left-4 top-4"><StatusBadge status={launch.status} /></div>
          <span className="absolute right-4 top-4 font-mono text-[10px] font-bold tracking-widest text-black/60">No. {String(index + 1).padStart(3, "0")}</span>
          <span className="absolute bottom-4 left-4 border-2 border-black bg-bg px-3 py-1 font-mono text-sm font-bold" style={{ color: `hsl(${h} 90% 70%)` }}>${launch.symbol}</span>
        </div>
        <div className="p-5">
          <h3 className="text-2xl font-semibold tracking-tight">{launch.name}</h3>
          {launch.status === "open" && (launch.closesAt || launch.closesInMs !== undefined) && (
            <div className="mt-4 flex items-center justify-between border border-seal bg-seal px-3.5 py-2.5 text-black">
              <span className="text-xs font-bold uppercase tracking-wider">closes in</span>
              <Countdown closesInMs={launch.closesInMs} closesAt={launch.closesAt} size="sm" className="font-bold text-black" />
            </div>
          )}
          <dl className="mt-4 grid grid-cols-2 gap-px sm:grid-cols-4 border border-line bg-line text-center">
            {[
              ["Supply", compact(launch.supply), "text-near"],
              [outcome ? "Cleared" : "Reserve", usd(outcome ? outcome.price : launch.reserve), outcome ? "text-verified" : "text-price"],
              ["Mkt cap", usd((outcome ? outcome.price : launch.reserve) * launch.supply, { compact: true }), "text-text"],
              ["Bids", launch.bidCount.toLocaleString("en-US"), "text-seal-fg"],
            ].map(([k, v, c]) => (
              <div key={k} className="bg-surface px-2 py-3">
                <dt className="text-[10px] uppercase tracking-wider text-faint">{k}</dt>
                <dd className={cx("mt-0.5 font-mono text-base font-semibold tabular-nums", c)}>{v}</dd>
              </div>
            ))}
          </dl>
        </div>
      </Link>
    </motion.div>
  );
}
