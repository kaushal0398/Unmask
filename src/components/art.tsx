import { cx } from "@/components/ui";

/**
 * The product's drawings, all inline SVG so they stay sharp at any size and cost no requests. Strokes use
 * `currentColor` so a parent sets the line colour; violet is the sealed accent and green the verified one.
 */
const V = "#8b7bff";
const G = "#00ec97";
const R = "#ff5c5c";

/** The mark: a square envelope with a violet seal. Also the favicon (src/app/icon.svg). */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden fill="none">
      <rect x="1.5" y="1.5" width="29" height="29" stroke="currentColor" strokeOpacity="0.9" />
      <path d="M1.5 1.5 L16 15 L30.5 1.5" stroke="currentColor" strokeOpacity="0.55" />
      <rect x="11.5" y="11.5" width="9" height="9" fill={V} />
      <rect x="14.5" y="14.5" width="3" height="3" fill="#000" />
    </svg>
  );
}

/** A closed envelope with a square wax seal and a lock. `locked` draws the seal; the rest is paper and folds. */
export function EnvelopeArt({ className, seal = true }: { className?: string; seal?: boolean }) {
  return (
    <svg viewBox="0 0 240 160" className={className} aria-hidden fill="none">
      <defs>
        <linearGradient id="paper" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#1b1b21" />
          <stop offset="1" stopColor="#0b0b0e" />
        </linearGradient>
        <linearGradient id="wax" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#a99dff" />
          <stop offset="1" stopColor="#6a55f2" />
        </linearGradient>
      </defs>
      <rect x="1" y="1" width="238" height="158" fill="url(#paper)" stroke="rgb(255 255 255 / 0.16)" />
      {/* the bottom folds and the flap */}
      <path d="M1 159 L100 82 M239 159 L140 82" stroke="rgb(255 255 255 / 0.08)" />
      <path d="M1 1 L120 90 L239 1" stroke="rgb(255 255 255 / 0.2)" />
      <path d="M1 1 L120 90 L239 1 Z" fill="rgb(255 255 255 / 0.025)" />
      {/* the address, hidden */}
      <g fill="rgb(255 255 255 / 0.12)">
        <rect x="150" y="124" width="62" height="3" />
        <rect x="150" y="133" width="44" height="3" />
        <rect x="150" y="142" width="54" height="3" />
      </g>
      <g stroke="rgb(255 255 255 / 0.18)">
        <path d="M14 14 h10 M14 14 v10" />
        <path d="M226 146 h-10 M226 146 v-10" />
      </g>
      {seal && (
        <g>
          <rect x="94" y="64" width="52" height="52" fill="url(#wax)" />
          <rect x="94.5" y="64.5" width="51" height="51" stroke="rgb(255 255 255 / 0.45)" />
          <rect x="100" y="70" width="40" height="40" stroke="rgb(0 0 0 / 0.28)" />
          {/* the lock */}
          <path d="M112 90 v-6 a8 8 0 0 1 16 0 v6" stroke="#000" strokeWidth="3" fill="none" />
          <rect x="108" y="90" width="24" height="16" fill="#000" />
          <rect x="118.5" y="95" width="3" height="6" fill={V} />
        </g>
      )}
    </svg>
  );
}

/** Concentric squares and crosshairs: the backdrop behind the hero envelope. */
export function SquaresBackdrop({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 400 400" className={className} aria-hidden fill="none">
      {[190, 150, 110, 70].map((s, i) => (
        <rect key={s} x={200 - s} y={200 - s} width={s * 2} height={s * 2} stroke={V} strokeOpacity={0.1 + i * 0.05} strokeDasharray={i % 2 ? "2 6" : undefined} />
      ))}
      <path d="M200 0 V30 M200 370 V400 M0 200 H30 M370 200 H400" stroke="rgb(255 255 255 / 0.25)" />
      <g stroke="rgb(255 255 255 / 0.3)">
        <path d="M6 20 V6 H20 M380 6 H394 V20 M394 380 V394 H380 M20 394 H6 V380" />
      </g>
    </svg>
  );
}

const frame = "h-24 w-full";

/** 01 Seal: a bid slip goes into an envelope. */
export function SealStepArt({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 220 96" className={cx(frame, className)} aria-hidden fill="none">
      <rect x="14" y="14" width="64" height="68" stroke="currentColor" strokeOpacity="0.5" />
      <g fill="currentColor" fillOpacity="0.35">
        <rect x="24" y="26" width="30" height="3" />
        <rect x="24" y="36" width="44" height="3" />
        <rect x="24" y="46" width="38" height="3" />
      </g>
      <text x="24" y="70" fill={V} fontFamily="monospace" fontSize="11">$0.03 × 4M</text>
      <path d="M92 48 H124" stroke={V} strokeDasharray="3 4" />
      <path d="M118 42 l8 6 l-8 6" stroke={V} />
      <rect x="140" y="26" width="66" height="46" stroke="currentColor" strokeOpacity="0.6" />
      <path d="M140 26 L173 52 L206 26" stroke="currentColor" strokeOpacity="0.5" />
      <rect x="165" y="44" width="16" height="16" fill={V} />
      <rect x="170.5" y="49.5" width="5" height="5" fill="#000" />
    </svg>
  );
}

/** 02 Wait: a timer, and sealed bids piling up with no amounts. */
export function WaitStepArt({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 220 96" className={cx(frame, className)} aria-hidden fill="none">
      <rect x="16" y="14" width="68" height="68" stroke="currentColor" strokeOpacity="0.55" />
      {Array.from({ length: 12 }, (_, i) => {
        const a = (i / 12) * Math.PI * 2;
        return <path key={i} d={`M${50 + Math.sin(a) * 28} ${48 - Math.cos(a) * 28} L${50 + Math.sin(a) * 32} ${48 - Math.cos(a) * 32}`} stroke="currentColor" strokeOpacity={i % 3 === 0 ? 0.8 : 0.3} />;
      })}
      <path d="M50 48 V28 M50 48 L64 56" stroke={V} strokeWidth="2" />
      <rect x="47" y="45" width="6" height="6" fill={V} />
      {[0, 1, 2, 3, 4].map((i) => (
        <g key={i} transform={`translate(${108 + (i % 3) * 36} ${18 + Math.floor(i / 3) * 38})`}>
          <rect width="30" height="22" stroke="currentColor" strokeOpacity="0.5" />
          <path d="M0 0 L15 12 L30 0" stroke="currentColor" strokeOpacity="0.35" />
          <rect x="11" y="8" width="8" height="8" fill={V} fillOpacity={0.5 + (i % 2) * 0.3} />
        </g>
      ))}
    </svg>
  );
}

/** 03 Clear: a descending staircase of bids, the clearing price line and the supply line. */
export function ClearStepArt({ className }: { className?: string }) {
  const bars = [60, 50, 40, 30, 22, 14];
  return (
    <svg viewBox="0 0 220 96" className={cx(frame, className)} aria-hidden fill="none">
      {bars.map((h, i) => {
        const won = i < 4;
        return <rect key={i} x={16 + i * 28} y={84 - h} width="26" height={h} fill={won ? G : "currentColor"} fillOpacity={won ? 0.22 : 0.08} stroke={won ? G : "currentColor"} strokeOpacity={won ? 0.9 : 0.35} />;
      })}
      <path d="M10 54 H210" stroke={G} strokeDasharray="4 4" />
      <path d="M128 10 V88" stroke="currentColor" strokeOpacity="0.6" strokeDasharray="2 5" />
      <text x="212" y="49" fill={G} fontFamily="monospace" fontSize="9" textAnchor="end">one price</text>
    </svg>
  );
}

/** 04 Verify: a shield with a check, and three hashes that agree. */
export function VerifyStepArt({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 220 96" className={cx(frame, className)} aria-hidden fill="none">
      <path d="M48 12 L82 22 V50 C82 66 66 78 48 84 C30 78 14 66 14 50 V22 Z" stroke={G} strokeOpacity="0.9" fill={G} fillOpacity="0.08" />
      <path d="M32 48 L44 60 L66 36" stroke={G} strokeWidth="3" />
      {[0, 1, 2].map((i) => (
        <g key={i}>
          <rect x="108" y={20 + i * 22} width="86" height="12" stroke="currentColor" strokeOpacity="0.35" />
          <text x="113" y={29.5 + i * 22} fill="currentColor" fillOpacity="0.7" fontFamily="monospace" fontSize="8">9f2c61b0d4e8…</text>
          <path d={`M200 ${26 + i * 22} l4 4 l8 -9`} stroke={G} strokeWidth="2" />
        </g>
      ))}
      <path d="M96 20 V76" stroke="currentColor" strokeOpacity="0.2" />
      <circle cx="96" cy="48" r="0" />
      <text x="96" y="92" fill={R} fillOpacity="0" fontSize="1">x</text>
    </svg>
  );
}
