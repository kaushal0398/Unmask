"use client";

import { animate, useInView } from "motion/react";
import { useEffect, useRef, useState } from "react";

/** Counts from `from` to `to` once it scrolls into view. `format` turns the running value into text. */
export function AnimatedNumber({ to, from = 0, duration = 1.2, delay = 0, format = (n: number) => String(Math.round(n)), className }: { to: number; from?: number; duration?: number; delay?: number; format?: (n: number) => string; className?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.6 });
  const [value, setValue] = useState(from);

  useEffect(() => {
    if (!inView) return;
    const controls = animate(from, to, { duration, delay, ease: [0.22, 1, 0.36, 1], onUpdate: setValue });
    return () => controls.stop();
  }, [inView, from, to, duration, delay]);

  return (
    <span ref={ref} className={className}>
      {format(value)}
    </span>
  );
}
