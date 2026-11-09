
"use client";

import { Menu, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { LogoMark } from "@/components/art";
import { ButtonLink, cx } from "@/components/ui";
import { WalletButton } from "@/components/wallet-button";

const links = [
  { href: "/launches", label: "Launches" },
  { href: "/my-bids", label: "My Bids" },
  { href: "/how-it-works", label: "How it works" },
  { href: "/compare", label: "Compare" },
  { href: "/verify", label: "Verify" },
  { href: "/faq", label: "FAQ" },
];

export function Logo({ className }: { className?: string }) {
  return (
    <Link
      href="/"
      className={cx(
        "flex items-center gap-2.5 font-semibold tracking-tight",
        className
      )}
      aria-label="Unmask, home"
    >
      <LogoMark className="size-7 text-text" />
      Unmask
    </Link>
  );
}

export function Nav() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const isActive = (href: string) =>
    pathname === href || pathname.startsWith(`${href}/`);

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-black/70 backdrop-blur-xl">
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-5 sm:px-8">
        <Logo />

        {/* Desktop navigation */}
        <nav className="hidden items-center gap-1 md:flex" aria-label="Main">
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              aria-current={isActive(l.href) ? "page" : undefined}
              className={cx(
                "rounded-none px-3.5 py-2 text-sm transition-colors hover:text-text",
                isActive(l.href) ? "text-text" : "text-muted"
              )}
            >
              {l.label}
            </Link>
          ))}
        </nav>

        <div className="hidden items-center gap-2 md:flex">
          <WalletButton />

          <ButtonLink href="/launches/new" tone="seal">
            Create launch
          </ButtonLink>
        </div>

        {/* Mobile menu toggle */}
        <button
          className="grid size-10 place-items-center rounded-none border border-line-strong md:hidden"
          onClick={() => setOpen((o) => !o)}
          aria-label={open ? "Close menu" : "Open menu"}
          aria-expanded={open}
        >
          {open ? (
            <X className="size-5" />
          ) : (
            <Menu className="size-5" />
          )}
        </button>
      </div>

      {/* Mobile navigation */}
      {open && (
        <div className="border-t border-line px-5 pb-5 pt-3 md:hidden">
          <nav className="flex flex-col" aria-label="Main">
            {links.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                onClick={() => setOpen(false)}
                aria-current={isActive(l.href) ? "page" : undefined}
                className={cx(
                  "rounded-none px-2 py-3 text-base hover:text-text",
                  isActive(l.href) ? "text-text" : "text-muted"
                )}
              >
                {l.label}
              </Link>
            ))}
          </nav>

          <div className="mt-3 flex flex-col gap-2">
            <ButtonLink
              href="/launches/new"
              tone="seal"
              onClick={() => setOpen(false)}
            >
              Create launch
            </ButtonLink>

            <WalletButton full />
          </div>
        </div>
      )}
    </header>
  );
}
