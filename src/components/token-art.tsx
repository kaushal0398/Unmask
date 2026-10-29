import { cx } from "@/components/ui";

/** A token's picture: a lit orb in its colour, with its mascot (or first letter). No image to load. */
export function TokenArt({ hue, symbol, emoji, size = 48, className }: { hue: number; symbol: string; emoji?: string; size?: number; className?: string }) {
  return (
    <div
      aria-hidden
      className={cx("relative grid shrink-0 place-items-center overflow-hidden rounded-none font-semibold text-black/80", className)}
      style={{
        width: size,
        height: size,
        fontSize: emoji ? size * 0.5 : size * 0.34,
        background: `radial-gradient(circle at 30% 25%, hsl(${hue} 95% 78%), hsl(${hue} 80% 52%) 55%, hsl(${(hue + 30) % 360} 70% 28%))`,
        boxShadow: `0 0 ${size * 0.6}px hsl(${hue} 90% 55% / 0.28), inset 0 -${size * 0.1}px ${size * 0.2}px rgb(0 0 0 / 0.25)`,
      }}
    >
      {emoji ?? symbol.slice(0, 1)}
    </div>
  );
}
