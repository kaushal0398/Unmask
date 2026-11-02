"use client";

import { ArrowLeft, Check, ExternalLink, Loader2, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AuctionLadder } from "@/components/auction-ladder";
import { BidForm } from "@/components/bid-form";
import { Countdown } from "@/components/countdown";
import { StatusBadge } from "@/components/launch-card";
import { SealedStack } from "@/components/sealed-stack";
import { TokenArt } from "@/components/token-art";
import { ButtonLink, Card, DemoNote, Mono, Stat } from "@/components/ui";
import { getLaunch, outcomeOf, revealOf, type Launch, type LaunchStatus } from "@/lib/demo";
import { compact, shortHash, tokens, usd } from "@/lib/format";
import { stageOf } from "@/lib/stage";
import { useEffect, useState } from "react";
import { getApi } from "@/lib/api";
import { useNow, useOpenedAt } from "@/lib/use-now";

type LiveLaunchData = Launch & {
  closesAt?: string;
};

function Facts({ l }: { l: Launch }) {
  return (
    <dl className="grid grid-cols-2 gap-x-6 gap-y-5 sm:grid-cols-4">
      <Stat label="For sale" value={compact(l.supply)} hint={`${tokens(l.supply)} ${l.symbol}`} />
      <Stat label="Reserve price" value={usd(l.reserve)} hint="bids below it are out" />
      <Stat label="Cap per account" value={l.cap ? `${l.cap * 100}%` : "none"} hint={l.cap ? `${tokens(l.supply * l.cap)} tokens` : "one wallet can bid for any amount"} />
      <Stat label="Token contract" value={<Mono className="break-all text-base">{l.tokenContract}</Mono>} />
    </dl>
  );
}

function Header({ l, status }: { l: Launch; status: LaunchStatus }) {
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
            <StatusBadge status={status} />
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
    <div className="grid grid-cols-1 gap-8 lg:grid-cols-[1.15fr_1fr] [&>*]:min-w-0">
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

const SETTLING = ["Bidding closed", "Bids opened inside the enclave", "Finding the clearing price", "Sending tokens and refunds", "Publishing the proof"];
const stateOf = (i: number, step: number) => (i < step ? "done" : i === step ? "active" : "todo");

function SettlingView({ l, step }: { l: Launch; step: number }) {
  return (
    <div className="grid grid-cols-1 gap-8 lg:grid-cols-[1.15fr_1fr] [&>*]:min-w-0">
      <Card className="p-6 sm:p-8">
        <h2 className="text-xl font-semibold tracking-tight">The enclave is counting</h2>
        <p className="mt-2 text-sm text-muted">No more bids are accepted. This usually takes under a minute.</p>
        <ol className="mt-6 space-y-4">
          {SETTLING.map((label, i) => {
            const state = stateOf(i, step);
            return (
              <li key={label} className="flex items-center gap-3.5">
                <span className={`grid size-7 place-items-center rounded-none border ${state === "done" ? "border-verified bg-verified text-black" : state === "active" ? "border-seal text-seal" : "border-line-strong text-faint"}`}>
                  {state === "done" ? <Check className="size-4" strokeWidth={3} /> : state === "active" ? <Loader2 className="size-4 animate-spin" /> : null}
                </span>
                <span className={state === "todo" ? "text-faint" : "text-text"}>{label}</span>
              </li>
            );
          })}
        </ol>
        <div className="mt-8 border-t border-line pt-6"><Facts l={l} /></div>
      </Card>
      <Card className="p-6"><SealedStack base={l.bidCount} live={false} /></Card>
    </div>
  );
}


function SettledView({ l }: { l: Launch }) {
  const o = outcomeOf(l) ?? revealOf(l);

  // Backend-created launches don't have demo outcome data yet.
  // Never assume a settlement result exists.
  if (!o) {
    return (
      <div className="space-y-8">
        <Card className="p-6 sm:p-10">
          <div className="flex items-center gap-3">
            <span className="grid size-10 place-items-center border border-verified text-verified">
              <ShieldCheck className="size-5" />
            </span>
            <div>
              <p className="text-xs uppercase tracking-widest text-verified">
                Bidding closed
              </p>
              <h2 className="mt-1 text-2xl font-semibold">
                No more bids are accepted.
              </h2>
            </div>
          </div>

          <p className="mt-4 max-w-xl text-sm leading-relaxed text-muted">
            This launch has reached its bidding deadline. Its settlement
            result is not available yet. No clearing price or token
            allocation can be displayed until a verified result is published.
          </p>

          <div className="mt-8 border-t border-line pt-6">
            <Facts l={l} />
          </div>
        </Card>

        <Card className="p-6">
          <h3 className="font-semibold">Settlement pending</h3>
          <p className="mt-2 text-sm text-muted">
            The settlement and verification integration is not connected
            for this development launch.
          </p>
          <p className="mt-3 text-xs text-faint">
            This page will not invent auction results or allocations.
          </p>
        </Card>
      </div>
    );
  }

  const sampled = l.status !== "settled" && l.bidCount > (l.bids?.length ?? 0);
  const bots = o.fills.filter((f) => f.bid.isBot);
  const botsFilled = bots.reduce((s, f) => s + f.filled, 0);

  return (
    <div className="space-y-8">
      <Card className="relative overflow-hidden p-6 sm:p-10">
        <div className="glow-verified pointer-events-none absolute inset-0" />
        <div className="relative grid gap-8 lg:grid-cols-[1.2fr_1fr] lg:items-end">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-verified">
              Cleared at one price for everyone
            </p>
            <p className="mt-3 font-mono text-6xl font-medium tabular-nums tracking-tight sm:text-8xl">
              {usd(o.price)}
            </p>
            <p className="mt-3 text-muted">
              per {l.symbol}. Whatever they offered, every winner paid exactly this.
            </p>
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
        <p className="mt-2 max-w-2xl text-sm text-muted">
          While bidding was open this looked like a stack of sealed envelopes.
          Open them to see how the price was found.
        </p>
        {sampled && (
          <p className="mt-2 text-xs text-faint" role="note">
            Demo: showing a sample of {l.bids?.length} of the {l.bidCount} bids.
          </p>
        )}
        <div className="mt-6">
          <AuctionLadder outcome={o} symbol={l.symbol} />
        </div>
      </div>

      <Card className="p-6 sm:p-8">
        <div className="flex flex-wrap items-center justify-between gap-5">
          <div className="max-w-xl">
            <h3 className="flex items-center gap-2 text-lg font-semibold">
              <ShieldCheck className="size-5 text-verified" />
              Check it yourself
            </h3>
            <p className="mt-2 text-sm text-muted">
              Everything needed to recompute this result is public:
              the code hash, the input hash and the attestation.
            </p>
            <dl className="mt-4 space-y-1.5 text-xs">
              <div className="flex gap-3">
                <dt className="w-24 text-faint">Code hash</dt>
                <dd><Mono>{shortHash(l.codeHash, 12, 8)}</Mono></dd>
              </div>
              <div className="flex gap-3">
                <dt className="w-24 text-faint">Input hash</dt>
                <dd><Mono>{l.inputHash ? shortHash(l.inputHash, 12, 8) : ""}</Mono></dd>
              </div>
              <div className="flex gap-3">
                <dt className="w-24 text-faint">Attestation</dt>
                <dd><Mono>{l.attestation ? shortHash(l.attestation, 12, 8) : ""}</Mono></dd>
              </div>
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


/**
 * One launch, live. Its stage follows the page's clock: an open launch closes when its time runs out, then the enclave
 * settles it in steps, then the result is shown. Before the browser has the time it shows the launch as it was
 * published, so the prerendered page and the first client render match.
 */

export function LiveLaunch({ id }: { id: string }) {
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [l, setL] = useState<LiveLaunchData | null>(null);
  const now = useNow();
  const opened = useOpenedAt();

  useEffect(() => {
    let active = true;

    setLoading(true);
    setError("");

    getApi()
      .getLaunch(id)
      .then((launch) => {
        if (active) {
          setL(launch);
        }
      })
      .catch((err) => {
        if (active) {
          setError(
            err instanceof Error
              ? err.message
              : "Could not load this launch.",
          );
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [id]);

  if (loading) {
    return <p className="py-16 text-center text-muted">Loading launch...</p>;
  }

  if (error) {
    return <p className="py-16 text-center text-red-400">{error}</p>;
  }

  if (!l) notFound();

  const closesInMs =
    l.closesAt && now !== null
      ? Math.max(0, new Date(l.closesAt).getTime() - now)
      : l.closesInMs;

  const liveLaunch = { ...l, closesInMs };

  
  const isDemoLaunch = Boolean(getLaunch(id));

  const deadlinePassed =
    Boolean(
      liveLaunch.closesAt &&
      now !== null &&
      new Date(liveLaunch.closesAt).getTime() <= now
    );

  const demoStage =
    isDemoLaunch && now !== null && opened !== null
      ? stageOf({
          status: liveLaunch.status,
          closesInMs: liveLaunch.closesInMs,
          openedAt: opened,
          now,
        })
      : null;

  const hasOutcome = Boolean(
    outcomeOf(liveLaunch) ?? revealOf(liveLaunch)
  );

  // Demo launches use the simulated clock.
  // Backend launches must never be marked settled without a result.
  const kind = isDemoLaunch
    ? demoStage?.kind ??
      (liveLaunch.status === "open"
        ? "open"
        : liveLaunch.status === "sealed"
          ? "settling"
          : "settled")
    : liveLaunch.status === "open" && !deadlinePassed
      ? "open"
      : liveLaunch.status === "settled" && hasOutcome
        ? "settled"
        : "pending";

  const status: LaunchStatus =
    kind === "open"
      ? "open"
      : kind === "settled"
        ? "settled"
        : "sealed";

  return (
    <>
      <Header l={liveLaunch} status={status} />

      <div className="mt-10">
        {kind === "open" ? (
          <OpenView l={liveLaunch} />
        ) : kind === "settling" ? (
          <SettlingView
            l={liveLaunch}
            step={demoStage?.kind === "settling" ? demoStage.step : 0}
          />
        ) : (
          <SettledView l={liveLaunch} />
        )}
      </div>
    </>
  );
}
