/** A price per token: up to four decimals under a dollar, trimmed. */
export function usd(n: number, opts: { compact?: boolean } = {}): string {
  if (opts.compact && Math.abs(n) >= 10_000) return `$${new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 }).format(n)}`;
  const digits = Math.abs(n) < 1 ? 4 : 2;
  return `$${new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: digits }).format(n)}`;
}

export const tokens = (n: number) => new Intl.NumberFormat("en-US").format(Math.round(n));

export const compact = (n: number) => new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 }).format(n);

export const shortHash = (h: string, head = 8, tail = 6) => (h.length <= head + tail + 1 ? h : `${h.slice(0, head)}…${h.slice(-tail)}`);

/** 2h 05m, 14m 32s, 48s. */
export function span(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const two = (x: number) => String(x).padStart(2, "0");
  if (h > 0) return `${h}h ${two(m)}m`;
  if (m > 0) return `${m}m ${two(sec)}s`;
  return `${sec}s`;
}
