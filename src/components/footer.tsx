import { ArrowUpRight } from "lucide-react";
import Link from "next/link";
import { LogoMark } from "@/components/art";
import { Container } from "@/components/ui";

const columns = [
  {
    title: "Product",
    links: [
      { href: "/launches", label: "Launches" },
      { href: "/launches/new", label: "Create a launch" },
      { href: "/portfolio", label: "My bids" },
      { href: "/verify", label: "Verify a result" },
    ],
  },
  {
    title: "Learn",
    links: [
      { href: "/how-it-works", label: "How it works" },
      { href: "/compare", label: "Unmask vs first-come" },
      { href: "/faq", label: "FAQ" },
    ],
  },
  {
    title: "Build",
    links: [
      { href: "/creators", label: "For creators" },
      { href: "/how-it-works#rule", label: "The auction rule" },
    ],
  },
];

/**
 * The footer, and under it the name in letters too big to miss. The wordmark fades into the black and is cut off
 * at the bottom edge on purpose, the way the envelope on the hero is only ever half shown.
 */
export function Footer() {
  return (
    <footer className="mt-24 border-t border-line">
      <Container className="py-16">
        <div className="grid gap-12 lg:grid-cols-[1.3fr_2fr]">
          <div>
            <Link href="/" className="flex items-center gap-3 text-3xl font-semibold tracking-tight" aria-label="Unmask, home">
              <LogoMark className="size-16" /> Unmask
            </Link>
            <p className="mt-5 max-w-sm text-sm leading-relaxed text-muted">
              The token launch where bots lose their edge. Bid blind, win fair, check everything. Sealed-bid launches on NEAR.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-8 sm:grid-cols-3">
            {columns.map((c) => (
              <nav key={c.title} aria-label={c.title}>
                <p className="font-mono text-xs uppercase tracking-widest text-faint">{c.title}</p>
                <ul className="mt-5 space-y-3 text-sm">
                  {c.links.map((l) => (
                    <li key={l.href}>
                      <Link href={l.href} className="group inline-flex items-center gap-1 text-muted transition-colors hover:text-text">
                        {l.label}
                        <ArrowUpRight className="size-3.5 -translate-x-1 opacity-0 transition-all group-hover:translate-x-0 group-hover:opacity-100" />
                      </Link>
                    </li>
                  ))}
                </ul>
              </nav>
            ))}
          </div>
        </div>
      </Container>

      <div className="relative overflow-hidden border-t border-line" aria-hidden>
        <p className="relative -mb-[3vw] select-none px-2 text-center text-[27vw] font-extrabold uppercase leading-[0.82] tracking-tighter text-white [-webkit-text-stroke:2px_#ffffff] sm:text-[24vw]">
          Unmask
        </p>
      </div>
    </footer>
  );
}
