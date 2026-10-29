import { ArrowLeft, Check, ExternalLink, Loader2, ShieldCheck } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { AuctionLadder } from "@/components/auction-ladder";
import { BidForm } from "@/components/bid-form";
import { Countdown } from "@/components/countdown";
import { StatusBadge } from "@/components/launch-card";
import { SealedStack } from "@/components/sealed-stack";
import { TokenArt } from "@/components/token-art";
import { ButtonLink, Card, Container, DemoNote, Mono, Stat } from "@/components/ui";
import { LAUNCHES, getLaunch, outcomeOf, type Launch } from "@/lib/demo";
import { compact, shortHash, tokens, usd } from "@/lib/format";

export function generateStaticParams() {
  return LAUNCHES.map((l) => ({ id: l.id }));
}

export async function generateMetadata({ params }: PageProps<"/launches/[id]">): Promise<Metadata> {
  const l = getLaunch((await params).id);
  return { title: l ? `${l.name} ($${l.symbol})` : "Launch" };
}

function Facts({ l }: { l: Launch }) {
  return (
    <dl className="grid grid-cols-2 gap-x-6 gap-y-5 sm:grid-cols-4">
      <Stat label="For sale" value={compact(l.supply)} hint={`${tokens(l.supply)} ${l.symbol}`} />
      <Stat label="Reserve price" value={usd(l.reserve)} hint="bids below it are out" />
      <Stat label="Cap per account" value={l.cap ? `${l.cap * 100}%` : "none"} hint={l.cap ? `${tokens(l.supply * l.cap)} tokens` : "one wallet can bid for any amount"} />
      <Stat label="Token contract" value={<Mono className="text-base">{l.tokenContract}</Mono>} />
    </dl>
  );
}

function Header({ l }: { l: Launch }) {
  return (
    <div>
      <Link href="/launches" className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-text">
        <ArrowLeft className="size-4" /> All launches
      </Link>
      <div className="mt-6 flex flex-wrap items-center gap-5">
        <TokenArt hue={l.hue} emoji={l.emoji} symbol={l.symbol} size={84} />
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">{l.name}</h1>
            <StatusBadge status={l.status} />
          </div>
          <p className="mt-2 text-muted">
            <span className="font-mono">${l.symbol}</span> · by <span className="font-mono">{l.creator}</span> — {l.tagline}
          </p>
        </div>
      </div>
      <div className="mt-5"><DemoNote /></div>
    </div>
  );
}

function OpenView({ l }: { l: Launch }) {
  return (
    <div className="grid gap-8 lg:grid-cols-[1.15fr_1fr]">
      <div className="space-y-8">
        <Card className="relative overflow-hidden p-6 sm:p-8">
          <div className="glow-seal pointer-events-none absolute inset-0 opacity-60" />
          <div className="relative">
            <p className="text-xs uppercase tracking-[0.2em] text-seal">Bidding closes in</p>
            <Countdown closesInMs={l.closesInMs ?? 0} className="mt-4" />
            <SealedStack base={l.bidCount} className="mt-6" />
          </div>
        </Card>
        <Card className="p-6 sm:p-8">
          <Facts l={l} />
        </Card>
      </div>
      <div className="space-y-6">
        <BidForm launch={l} />
        <Card className="p-6">
          <h3 className="flex items-center gap-2 font-semibold"><ShieldCheck className="size-4 text-verified" /> Why you can&apos;t be sniped</h3>
          <ul className="mt-4 space-y-3 text-sm leading-relaxed text-muted">
            <li>Nobody sees any bid until the close, so there is nothing to react to.</li>
            <li>Arriving first or last changes nothing. Bids are ranked by price.</li>
            <li>Everyone who wins pays the same price, which can be lower than the most they offered.</li>
            <li>Anyone can check the result afterwards, on the verify page.</li>
          </ul>
        </Card>
      </div>
    </div>
  );
}

const SETTLING = [
  { label: "Bidding closed", state: "done" },
  { label: "Bids opened inside the enclave", state: "done" },
  { label: "Finding the clearing price", state: "active" },
  { label: "Sending tokens and refunds", state: "todo" },
  { label: "Publishing the proof", state: "todo" },
] as const;

function SettlingView({ l }: { l: Launch }) {
  return (
    <div className="grid gap-8 lg:grid-cols-[1.15fr_1fr]">
      <Card className="p-6 sm:p-8">
        <h2 className="text-xl font-semibold tracking-tight">The enclave is counting</h2>
        <p className="mt-2 text-sm text-muted">No more bids are accepted. This usually takes under a minute.</p>
        <ol className="mt-6 space-y-4">
          {SETTLING.map((s) => (
            <li key={s.label} className="flex items-center gap-3.5">
              <span className={`grid size-7 place-items-center rounded-none border ${s.state === "done" ? "border-verified bg-verified text-black" : s.state === "active" ? "border-seal text-seal" : "border-line-strong text-faint"}`}>
                {s.state === "done" ? <Check className="size-4" strokeWidth={3} /> : s.state === "active" ? <Loader2 className="size-4 animate-spin" /> : null}
              </span>
              <span className={s.state === "todo" ? "text-faint" : "text-text"}>{s.label}</span>
            </li>
          ))}
        </ol>
        <div className="mt-8 border-t border-line pt-6"><Facts l={l} /></div>
      </Card>
      <Card className="p-6"><SealedStack base={l.bidCount} live={false} /></Card>
    </div>
  );
}

function SettledView({ l }: { l: Launch }) {
  const o = outcomeOf(l)!;
  const bots = o.fills.filter((f) => f.bid.isBot);
  const botsFilled = bots.reduce((s, f) => s + f.filled, 0);
  return (
    <div className="space-y-8">
      <Card className="relative overflow-hidden p-6 sm:p-10">
        <div className="glow-verified pointer-events-none absolute inset-0" />
        <div className="relative grid gap-8 lg:grid-cols-[1.2fr_1fr] lg:items-end">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-verified">Cleared at one price for everyone</p>
            <p className="mt-3 font-mono text-6xl font-medium tabular-nums tracking-tight sm:text-8xl">{usd(o.price)}</p>
            <p className="mt-3 text-muted">per {l.symbol}. Whatever they offered, every winner paid exactly this.</p>
          </div>
          <dl className="grid grid-cols-3 gap-4">
            <Stat label="Raised" value={usd(o.raised, { compact: true })} tone="verified" />
            <Stat label="Sold" value={`${Math.round((o.sold / o.supply) * 100)}%`} hint={`${tokens(o.sold)} tokens`} />
            <Stat label="Bots won" value={`${Math.round((botsFilled / o.supply) * 100)}%`} hint={bots.length ? `${bots.length} bot wallets bid` : "none bid"} tone={botsFilled ? undefined : "verified"} />
          </dl>
        </div>
      </Card>

      <div>
        <h2 className="text-2xl font-semibold tracking-tight">The sealed bids, opened</h2>
        <p className="mt-2 max-w-2xl text-sm text-muted">While bidding was open this looked like a stack of sealed envelopes. Open them to see how the price was found.</p>
        <div className="mt-6"><AuctionLadder outcome={o} symbol={l.symbol} /></div>
      </div>

      <Card className="p-6 sm:p-8">
        <div className="flex flex-wrap items-center justify-between gap-5">
          <div className="max-w-xl">
            <h3 className="flex items-center gap-2 text-lg font-semibold"><ShieldCheck className="size-5 text-verified" /> Check it yourself</h3>
            <p className="mt-2 text-sm text-muted">Everything needed to recompute this result is public: the code hash, the input hash and the attestation.</p>
            <dl className="mt-4 space-y-1.5 text-xs">
              <div className="flex gap-3"><dt className="w-24 text-faint">Code hash</dt><dd><Mono>{shortHash(l.codeHash, 12, 8)}</Mono></dd></div>
              <div className="flex gap-3"><dt className="w-24 text-faint">Input hash</dt><dd><Mono>{l.inputHash ? shortHash(l.inputHash, 12, 8) : ""}</Mono></dd></div>
              <div className="flex gap-3"><dt className="w-24 text-faint">Attestation</dt><dd><Mono>{l.attestation ? shortHash(l.attestation, 12, 8) : ""}</Mono></dd></div>
            </dl>
          </div>
          <ButtonLink href={`/verify?launch=${l.id}`} tone="primary">
            Verify this launch <ExternalLink className="size-4" />
          </ButtonLink>
        </div>
      </Card>
      <Facts l={l} />
    </div>
  );
}

async function LaunchBody({ params }: { params: PageProps<"/launches/[id]">["params"] }) {
  const l = getLaunch((await params).id);
  if (!l) notFound();
  return (
    <>
      <Header l={l} />
      <div className="mt-10">{l.status === "open" ? <OpenView l={l} /> : l.status === "sealed" ? <SettlingView l={l} /> : <SettledView l={l} />}</div>
    </>
  );
}

function LaunchSkeleton() {
  return (
    <div aria-busy className="space-y-8">
      <div className="h-6 w-28 rounded-none shimmer" />
      <div className="flex items-center gap-5">
        <div className="size-[84px] rounded-none shimmer" />
        <div className="space-y-3">
          <div className="h-9 w-64 rounded-none shimmer" />
          <div className="h-4 w-80 rounded-none shimmer" />
        </div>
      </div>
      <div className="h-96 rounded-none shimmer" />
    </div>
  );
}

export default function LaunchPage({ params }: PageProps<"/launches/[id]">) {
  return (
    <Container className="py-12 sm:py-16">
      <Suspense fallback={<LaunchSkeleton />}>
        <LaunchBody params={params} />
      </Suspense>
    </Container>
  );
}
