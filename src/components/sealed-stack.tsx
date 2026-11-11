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
      <SquaresBackdrop className="absolute inset-0 h-full w-full" />
      {/* Pulse rings: the seal holding */}
      {live && [0, 1].map((n) => (
        <motion.div
          key={`ring-${n}`}
          aria-hidden
          className="pointer-events-none absolute left-1/2 top-1/2 size-56 -translate-x-1/2 -translate-y-1/2 border-2 border-seal"
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: [0.7, 0], scale: [0.8, 1.7] }}
          transition={{ duration: 3.2, delay: n * 1.6, repeat: Infinity, ease: "easeOut" }}
        />
      ))}
      {/* Bots circling the pile, looking for a way in */}
      {live && (
        <motion.div aria-hidden className="pointer-events-none absolute inset-0" animate={{ rotate: 360 }} transition={{ duration: 16, repeat: Infinity, ease: "linear" }}>
          {[0, 90, 180, 270].map((deg) => (
            <div key={deg} className="absolute left-1/2 top-1/2" style={{ transform: `rotate(${deg}deg) translateY(-44%)` }}>
              <motion.div
                className="-ml-3 -mt-3 grid size-6 place-items-center border-2 border-danger bg-bg font-mono text-[10px] font-bold text-danger"
                animate={{ opacity: [1, 0.35, 1] }}
                transition={{ duration: 1.6, delay: deg / 360, repeat: Infinity }}
              >
                ✕
              </motion.div>
            </div>
          ))}
        </motion.div>
      )}
      <div className="absolute inset-0 grid place-items-center">
        <div className="relative h-44 w-72 sm:h-52 sm:w-80">
          {layers.map((l, i) => (
            <motion.div
              key={i}
              className="absolute inset-0"
              initial={{ opacity: 0, y: -40, scale: 0.9 }}
              animate={{ opacity: 1, y: [l.y, l.y - 7, l.y], x: l.x, scale: 1 }}
              transition={{
                opacity: { delay: 0.15 * i, duration: 0.6 },
                scale: { delay: 0.15 * i, duration: 0.6, ease: [0.22, 1, 0.36, 1] },
                x: { delay: 0.15 * i, duration: 0.6, ease: [0.22, 1, 0.36, 1] },
                y: { delay: 0.15 * i + 0.6, duration: 3.6 + i * 0.5, repeat: Infinity, ease: "easeInOut" },
              }}
            >
              <div className="h-full w-full" style={{ transform: `rotate(${l.r}deg)` }}>
                <EnvelopeArt seal={i === layers.length - 1} className="h-full w-full drop-shadow-[0_18px_40px_rgb(0_0_0/0.7)]" />
              </div>
            </motion.div>
          ))}
        </div>
      </div>
      {/* New bids drop in from above, sealed, then vanish into the pile */}
      {live && [0, 1, 2].map((n) => (
        <motion.div
          key={n}
          aria-hidden
          className="absolute left-1/2 top-[6%] -ml-12 flex h-8 w-24 items-center justify-center border border-seal bg-seal font-mono text-xs font-bold text-black"
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: [0, 1, 1, 0], y: [-10, 40, 110, 150], x: [(n - 1) * 70, (n - 1) * 40, (n - 1) * 14, 0] }}
          transition={{ duration: 3.2, delay: n * 1.07, repeat: Infinity, ease: "easeIn", times: [0, 0.2, 0.8, 1] }}
        >
          •••• NEAR
        </motion.div>
      ))}
      {/* A scanning line: the bots look, and see nothing */}
      {live && (
        <motion.div
          aria-hidden
          className="pointer-events-none absolute inset-x-6 h-px bg-danger/70"
          animate={{ top: ["10%", "70%", "10%"] }}
          transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
        />
      )}
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
