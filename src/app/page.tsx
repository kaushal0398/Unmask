import { ArrowRight, Eye, EyeOff, ShieldCheck } from "lucide-react";
import * as motion from "motion/react-client";
import Link from "next/link";
import { AuctionLadder } from "@/components/auction-ladder";
import { NearLogo } from "@/components/art";
import { HowItWorks } from "@/components/how-it-works";
import { LaunchCard } from "@/components/launch-card";
import { RaceDemo } from "@/components/race-demo";
import { SealedStack } from "@/components/sealed-stack";
import { Ticker } from "@/components/ticker";
import { ButtonLink, Card, Container, Emph, Eyebrow, SectionHeading } from "@/components/ui";
import { getLaunch, outcomeOf } from "@/lib/demo";

export default function Home() {
  const pup = getLaunch("pixelpup")!;
  const featured = ["moonbean", "frogwave", "pixelpup"].map((id) => getLaunch(id)!);
  const pupOutcome = outcomeOf(pup)!;

  return (
    <>
      {/* Hero */}
      <section className="relative overflow-hidden">
        <Container className="relative grid items-center gap-10 pb-16 pt-16 sm:pt-24 lg:grid-cols-[1.1fr_0.9fr] lg:pb-24">
          <div>
            <p className="inline-flex items-center gap-2 border border-white bg-bg px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-white">
              Unmask · Sealed-bid launches on <NearLogo className="size-5" />
            </p>
            <h1 className="mt-6 text-5xl font-semibold leading-[1.02] tracking-tight text-balance sm:text-7xl">
              The token launch where <Emph>bots lose</Emph> their edge.
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-relaxed text-muted text-pretty">
              Bid blind, win fair, check everything. Every bid is sealed until the window closes, then one price is found and everyone pays it. Fast no longer wins, and anyone can verify the auction ran honestly.
            </p>
            <div className="mt-9 flex flex-wrap gap-3">
              <ButtonLink href="/launches" tone="seal" className="px-7 py-3.5 text-base">
                Browse launches <ArrowRight className="size-4" />
              </ButtonLink>
              <ButtonLink href="#race" tone="ghost" className="px-7 py-3.5 text-base">
                Watch the bots lose
              </ButtonLink>
            </div>
          </div>
          <div className="relative">
            <SealedStack base={214} />
            <motion.div animate={{ y: [0, -8, 0], rotate: [-6, -4, -6] }} transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }} className="absolute -left-2 top-6 hidden border-2 border-danger bg-surface p-3 sm:block">
              <p className="text-[10px] uppercase tracking-widest text-faint">bots watching</p>
              <p className="mt-1 flex items-center gap-2 font-mono text-sm text-danger"><EyeOff className="size-4" /> 0 amounts visible</p>
            </motion.div>
            <motion.div animate={{ y: [0, 8, 0], rotate: [5, 3, 5] }} transition={{ duration: 4.6, repeat: Infinity, ease: "easeInOut" }} className="absolute -right-1 bottom-24 hidden border-2 border-verified bg-surface p-3 sm:block">
              <p className="text-[10px] uppercase tracking-widest text-faint">everyone pays</p>
              <p className="mt-1 font-mono text-sm text-verified">one price</p>
            </motion.div>
          </div>
        </Container>
      </section>

      <Ticker />

      {/* The race */}
      <section id="race" className="scroll-mt-20 py-20 sm:py-28">
        <Container>
          <SectionHeading tone="hot" eyebrow="The problem, in one picture" title={<>Same eleven bids. Two launches. <Emph>Only one</Emph> lets the bots win.</>}>
            On most launchpads whoever is fastest gets the cheap tokens, then sells into everyone who arrives later. Take away the speed advantage and the sniper has nothing left to sell.
          </SectionHeading>
          <div className="mt-12"><RaceDemo /></div>
        </Container>
      </section>

      {/* Why Unmask */}
      <section className="py-20 sm:py-28">
        <Container>
          <SectionHeading tone="near" eyebrow="Why Unmask" title={<>A normal launchpad rewards speed. <Emph>Unmask</Emph> rewards nothing but a real bid.</>}>
            Same token, same buyers. Only the rules change.
          </SectionHeading>
          <div className="mt-12 grid gap-5 md:grid-cols-2">
            <Card className="border-danger/25 p-7">
              <p className="flex items-center gap-2 text-sm font-medium text-danger"><EyeOff className="size-4" /> First-come launchpad</p>
              <ul className="mt-6 space-y-4 text-sm text-muted">
                {["Orders are visible, so bots react to them", "The first blocks get the cheapest tokens", "Wallet bundles sell into late buyers", "Price depends on who clicked first"].map((t) => (
                  <li key={t} className="border-b border-line pb-4 last:border-0 last:pb-0">{t}</li>
                ))}
              </ul>
            </Card>
            <Card className="border-verified/25 p-7">
              <p className="flex items-center gap-2 text-sm font-medium text-verified"><ShieldCheck className="size-4" /> Unmask launch</p>
              <ul className="mt-6 space-y-4 text-sm text-muted">
                {["Bids are sealed, so there is nothing to react to", "Arriving first or last changes nothing", "One clearing price for every winner", "Result, code hash and attestation are public"].map((t) => (
                  <li key={t} className="border-b border-line pb-4 last:border-0 last:pb-0">{t}</li>
                ))}
              </ul>
            </Card>
          </div>
        </Container>
      </section>

      {/* Live now: the meme cards */}
      <section className="py-20 sm:py-28">
        <Container>
          <div className="flex flex-wrap items-end justify-between gap-5">
            <SectionHeading eyebrow="Live right now" title="Pick a coin. Seal a bid.">Open launches are taking sealed bids. Settled ones show their proof.</SectionHeading>
            <div className="flex flex-col items-start gap-3">
              <Link href="/launches" className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-text">All launches <ArrowRight className="size-4" /></Link>
            </div>
          </div>
          <ul className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {featured.map((l, i) => (
              <li key={l.id}><LaunchCard launch={l} index={i} /></li>
            ))}
          </ul>
        </Container>
      </section>

      {/* How it works */}
      <section id="how" className="scroll-mt-20 py-20 sm:py-28">
        <Container>
          <SectionHeading eyebrow="How it works" title={<>Four steps, and <Emph>no one</Emph> has to be trusted.</>}>
            The auction runs inside a hardware enclave. Its code is public, and it signs what it did.
          </SectionHeading>
          <div className="mt-12"><HowItWorks /></div>
        </Container>
      </section>

      {/* An auction clearing */}
      <section className="py-20 sm:py-28">
        <Container>
          <div className="grid grid-cols-1 gap-12 lg:grid-cols-[0.8fr_1.2fr] lg:items-start [&>*]:min-w-0">
            <div className="lg:sticky lg:top-28">
              <SectionHeading tone="price" eyebrow="See it clear" title={<>One price, found <Emph>after</Emph> the close.</>}>
                Bids stack from the highest price down. Where the stack reaches the supply is the clearing price, and everyone to the left pays it, even if they offered more.
              </SectionHeading>
              <ul className="mt-8 space-y-4 text-sm leading-relaxed text-muted">
                <li className="flex gap-3"><Eye className="mt-0.5 size-4 shrink-0 text-seal-fg" /> Press <strong className="text-text">Open the bids</strong> to break the seals.</li>
                <li className="flex gap-3"><ShieldCheck className="mt-0.5 size-4 shrink-0 text-verified" /> The four red bars are bot wallets that bid low, hoping for a cheap start. They are priced out and refunded.</li>
              </ul>
            </div>
            <AuctionLadder outcome={pupOutcome} symbol={pup.symbol} />
          </div>
        </Container>
      </section>

      {/* Hidden vs public */}
      <section className="py-20 sm:py-28">
        <Container>
          <SectionHeading eyebrow="Privacy and proof" title="Hidden while it matters. Public once it can&apos;t hurt.">Secrecy protects the bidding. Openness protects everyone after it.</SectionHeading>
          <div className="mt-12 grid gap-5 md:grid-cols-2">
            <Card className="border-seal/25 p-7">
              <p className="flex items-center gap-2 text-sm font-medium text-seal-fg"><EyeOff className="size-4" /> During bidding</p>
              <dl className="mt-6 space-y-4 text-sm">
                <div className="flex justify-between gap-6 border-b border-line pb-4"><dt className="text-muted">Launch rules and reserve</dt><dd>public</dd></div>
                <div className="flex justify-between gap-6 border-b border-line pb-4"><dt className="text-muted">How many bids</dt><dd>public</dd></div>
                <div className="flex justify-between gap-6 border-b border-line pb-4"><dt className="text-muted">Prices and quantities</dt><dd className="text-seal-fg">sealed</dd></div>
                <div className="flex justify-between gap-6"><dt className="text-muted">Who bid what</dt><dd className="text-seal-fg">sealed</dd></div>
              </dl>
            </Card>
            <Card className="border-verified/25 p-7">
              <p className="flex items-center gap-2 text-sm font-medium text-verified"><Eye className="size-4" /> After settlement</p>
              <dl className="mt-6 space-y-4 text-sm">
                <div className="flex justify-between gap-6 border-b border-line pb-4"><dt className="text-muted">Clearing price</dt><dd className="text-verified">public</dd></div>
                <div className="flex justify-between gap-6 border-b border-line pb-4"><dt className="text-muted">Each winner&apos;s allocation</dt><dd className="text-verified">public</dd></div>
                <div className="flex justify-between gap-6 border-b border-line pb-4"><dt className="text-muted">Code hash and attestation</dt><dd className="text-verified">public</dd></div>
                <div className="flex justify-between gap-6"><dt className="text-muted">On-chain transfers</dt><dd className="text-verified">public</dd></div>
              </dl>
            </Card>
          </div>
        </Container>
      </section>

      {/* Built on NEAR */}
      <section className="py-14">
        <Container>
          <p className="text-center text-xs uppercase tracking-widest text-faint">Built on</p>
          <ul className="mt-6 flex flex-wrap items-center justify-center gap-x-10 gap-y-4 font-mono text-sm text-muted">
            {[["NEAR", "border-near/40 text-near"], ["OutLayer enclave (TEE)", "border-seal/40 text-seal-fg"], ["Payment checks", "border-verified/40 text-verified"], ["NEP-141 tokens", "border-price/40 text-price"], ["NEAR Intents", "border-hot/40 text-hot"]].map(([t, c]) => (
              <li key={t} className={`border px-4 py-2 ${c}`}>{t}</li>
            ))}
          </ul>
        </Container>
      </section>

      {/* Honest limits + CTA */}
      <section className="py-20 sm:py-28">
        <Container>
          <div className="grid gap-8 lg:grid-cols-2">
            <Card className="p-8">
              <Eyebrow tone="muted">What this does not do</Eyebrow>
              <ul className="mt-5 space-y-3 text-sm leading-relaxed text-muted">
                <li>It removes the timing and visibility advantage. It does not stop a rich buyer from buying a lot.</li>
                <li>It cannot tell one person with many wallets from many people. A cap per account helps a little.</li>
                <li>It promises no price, liquidity or return.</li>
              </ul>
            </Card>
            <Card className="relative overflow-hidden border-seal/30 p-8">
                            <div className="relative">
                <h2 className="text-3xl font-semibold tracking-tight text-balance">Ready to <Emph>unmask</Emph> a fair launch?</h2>
                <p className="mt-3 text-sm text-muted">Set the token, the reserve and the window. The auction does the rest.</p>
                <div className="mt-7 flex flex-wrap gap-3">
                  <ButtonLink href="/launches/new" tone="seal">Create a launch</ButtonLink>
                  <ButtonLink href="/verify" tone="ghost">See the proof</ButtonLink>
                </div>
              </div>
            </Card>
          </div>
        </Container>
      </section>
    </>
  );
}
