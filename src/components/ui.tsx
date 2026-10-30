import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";

export const cx = (...parts: Array<string | false | null | undefined>) => parts.filter(Boolean).join(" ");

type Tone = "neutral" | "seal" | "verified" | "danger";

const toneClass: Record<Tone, string> = {
  neutral: "border-line-strong text-muted",
  seal: "border-seal/30 bg-seal/10 text-seal",
  verified: "border-verified/30 bg-verified/10 text-verified",
  danger: "border-danger/30 bg-danger/10 text-danger",
};

export function Badge({ tone = "neutral", children, className }: { tone?: Tone; children: ReactNode; className?: string }) {
  return <span className={cx("inline-flex items-center gap-1.5 rounded-none border px-2.5 py-1 text-xs font-medium", toneClass[tone], className)}>{children}</span>;
}

const buttonBase =
  "inline-flex items-center justify-center gap-2 rounded-none px-5 py-2.5 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40";
const buttonTone = {
  primary: "bg-text text-bg hover:bg-white",
  seal: "bg-seal text-black hover:bg-[#a395ff]",
  ghost: "border border-line-strong text-text hover:bg-white/5",
} as const;

export function ButtonLink({ href, tone = "primary", className, ...rest }: { href: string; tone?: keyof typeof buttonTone } & Omit<ComponentProps<typeof Link>, "href">) {
  return <Link href={href} className={cx(buttonBase, buttonTone[tone], className)} {...rest} />;
}

export function Button({ tone = "primary", className, ...rest }: { tone?: keyof typeof buttonTone } & ComponentProps<"button">) {
  return <button className={cx(buttonBase, buttonTone[tone], className)} {...rest} />;
}

export function Card({ className, ...rest }: ComponentProps<"div">) {
  return <div className={cx("corners rounded-none border border-line bg-surface shadow-[inset_0_1px_0_rgb(255_255_255/0.05),0_28px_56px_-32px_rgb(0_0_0/0.95)]", className)} {...rest} />;
}

export function Eyebrow({ children, tone = "seal" }: { children: ReactNode; tone?: "seal" | "verified" | "muted" }) {
  return (
    <p className={cx("text-xs font-medium uppercase tracking-[0.18em]", tone === "seal" && "text-seal", tone === "verified" && "text-verified", tone === "muted" && "text-faint")}>
      {children}
    </p>
  );
}

export function SectionHeading({ eyebrow, title, children, tone }: { eyebrow?: string; title: ReactNode; children?: ReactNode; tone?: "seal" | "verified" | "muted" }) {
  return (
    <div className="max-w-2xl">
      {eyebrow && <Eyebrow tone={tone}>{eyebrow}</Eyebrow>}
      <h2 className="mt-3 text-3xl font-semibold tracking-tight text-balance sm:text-4xl">{title}</h2>
      {children && <p className="mt-4 text-base leading-relaxed text-muted text-pretty">{children}</p>}
    </div>
  );
}

/** Italic serif for the word a headline turns on. */
export const Emph = ({ children }: { children: ReactNode }) => <em className="font-serif font-normal italic tracking-normal">{children}</em>;

export const Mono = ({ children, className }: { children: ReactNode; className?: string }) => <span className={cx("font-mono text-[0.92em] tabular-nums", className)}>{children}</span>;

export function Container({ className, ...rest }: ComponentProps<"div">) {
  return <div className={cx("mx-auto w-full max-w-6xl px-5 sm:px-8", className)} {...rest} />;
}

export function Stat({ label, value, hint, tone, className }: { label: string; value: ReactNode; hint?: string; tone?: "seal" | "verified"; className?: string }) {
  return (
    <div className={className}>
      <dt className="text-xs uppercase tracking-wider text-faint">{label}</dt>
      <dd className={cx("mt-1.5 text-2xl font-semibold tabular-nums tracking-tight", tone === "seal" && "text-seal", tone === "verified" && "text-verified")}>{value}</dd>
      {hint && <dd className="mt-1 text-xs text-muted">{hint}</dd>}
    </div>
  );
}

/** Shown on every screen that runs on made-up data. */
export const DemoNote = ({ children }: { children?: ReactNode }) => (
  <p className="inline-flex items-center gap-2 rounded-none border border-dashed border-line-strong px-3 py-1 text-xs text-faint">
    <span className="size-1.5 rounded-none bg-faint" />
    {children ?? "Demo data. Nothing here is real yet."}
  </p>
);
