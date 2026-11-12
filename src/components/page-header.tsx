import type { ReactNode } from "react";
import { Container, Eyebrow } from "@/components/ui";

/** The top of an inside page: a small label, a big line, and a sentence under it. */
export function PageHeader({ eyebrow, title, children, tone }: { eyebrow: string; title: ReactNode; children?: ReactNode; tone?: "seal" | "verified" | "muted" }) {
  return (
    <div className="relative border-b border-line">
      <Container className="relative py-14 sm:py-20">
        <Eyebrow tone={tone}>{eyebrow}</Eyebrow>
        <h1 className="mt-4 max-w-3xl text-4xl font-semibold leading-[1.05] tracking-tight text-balance sm:text-6xl">{title}</h1>
        {children && <p className="mt-5 max-w-2xl text-lg leading-relaxed text-muted text-pretty">{children}</p>}
      </Container>
    </div>
  );
}
