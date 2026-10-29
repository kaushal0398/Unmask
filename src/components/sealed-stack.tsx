"use client";

import { AnimatePresence, motion } from "motion/react";
import { EnvelopeArt, SquaresBackdrop } from "@/components/art";
import { cx } from "@/components/ui";
import { useNow, useOpenedAt } from "@/lib/use-now";

/**
 * The picture the whole product turns on: bids as sealed envelopes. They pile up and are counted, and no amount is
 * ever shown. `base` is the count when the page opened; a demo adds one every few seconds.
 */
export function SealedStack({ base, className, live = true }: { base: number; className?: string; live?: boolean }) {
  const now = useNow();
  const opened = useOpenedAt();
  const extra = live && now !== null && opened !== null ? Math.floor((now - opened) / 6000) : 0;
  const count = base + extra;
  const layers = [
    { x: -34, y: 18, r: -7 },
    { x: 30, y: 10, r: 6 },
    { x: -14, y: -4, r: -2 },
    { x: 18, y: -16, r: 4 },
  ];

  return (
    <div className={cx("relative mx-auto aspect-square w-full max-w-md", className)}>
      <div className="glow-seal absolute inset-0" />
      <SquaresBackdrop className="absolute inset-0 h-full w-full" />
      <div className="absolute inset-0 grid place-items-center">
        <div className="relative h-44 w-72 sm:h-52 sm:w-80">
          {layers.map((l, i) => (
            <motion.div
              key={i}
              className="absolute inset-0"
              initial={{ opacity: 0, y: -40, scale: 0.9 }}
              animate={{ opacity: 1, y: l.y, x: l.x, scale: 1 }}
              transition={{ delay: 0.15 * i, duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
            >
              <div className="h-full w-full" style={{ transform: `rotate(${l.r}deg)` }}>
                <EnvelopeArt seal={i === layers.length - 1} className="h-full w-full drop-shadow-[0_18px_40px_rgb(0_0_0/0.7)]" />
              </div>
            </motion.div>
          ))}
        </div>
      </div>
      <div className="absolute inset-x-0 bottom-3 text-center">
        <p className="text-xs uppercase tracking-[0.2em] text-faint">sealed bids</p>
        <AnimatePresence mode="popLayout" initial={false}>
          <motion.p
            key={count}
            initial={{ y: 12, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -12, opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="font-mono text-4xl font-medium tabular-nums text-text"
          >
            {count.toLocaleString("en-US")}
          </motion.p>
        </AnimatePresence>
        <p className="mt-1 text-xs text-muted">amounts stay hidden until the close</p>
      </div>
    </div>
  );
}
