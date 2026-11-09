import type { Metadata } from "next";
import { PageHeader } from "@/components/page-header";
import { Badge, Card, Container } from "@/components/ui";

export const metadata: Metadata = { title: "Honest limits" };

const DOES_NOT = [
  "It removes the timing and visibility advantage. It does not stop a rich buyer from buying a lot.",
  "It cannot tell one person with many wallets from many people. A cap per account helps a little.",
  "It promises no price, no liquidity and no return.",
  "It is not legal advice. Token launches can be regulated where you live.",
];

const TRUST: Array<[string, string]> = [
  ["The enclave sees the bids", "The privacy guarantee is that the operator and everyone else cannot see or change them. That rests on the attestation and on the enclave's code being public."],
  ["The enclave holds funds during settlement", "While it settles, the enclave controls the locked funds, so the fairness claim depends on the attestation being checked."],
  ["A bidder can pull a payment check early", "That only cancels their own bid, and the enclave drops it at the close."],
];

const STATUS: Array<[string, "real" | "demo" | "next"]> = [
  ["The interface and every screen", "real"],
  ["The auction rule (uniform price, pro-rata at the price)", "real"],
  ["Hashing and re-running the rule on the verify page", "real"],
  ["Launches, bids and results on screen", "demo"],
  ["The attestation check", "demo"],
  ["The enclave that runs the auction", "next"],
  ["Payment checks and real funds", "next"],
  ["The NEP-141 token and payouts", "next"],
];

const tone = { real: "verified", demo: "seal", next: "neutral" } as const;
const label = { real: "built", demo: "demo", next: "not built yet" } as const;

export default function LimitsPage() {
  return (
    <>
      <PageHeader eyebrow="Honest limits" title="What this does, and what it does not.">We would rather you hear it from us.</PageHeader>
      <Container className="grid gap-8 py-14 sm:py-20 lg:grid-cols-2">
        <Card className="p-7">
          <h2 className="font-mono text-xs uppercase tracking-widest text-danger">What it does not do</h2>
          <ul className="mt-6 space-y-4 text-sm leading-relaxed text-muted">
            {DOES_NOT.map((t) => <li key={t} className="flex gap-3"><span className="mt-2 size-1.5 shrink-0 bg-danger" />{t}</li>)}
          </ul>
        </Card>
        <Card className="p-7">
          <h2 className="font-mono text-xs uppercase tracking-widest text-seal-fg">What you are trusting</h2>
          <dl className="mt-6 space-y-5">
            {TRUST.map(([k, v]) => (
              <div key={k}>
                <dt className="text-sm font-medium">{k}</dt>
                <dd className="mt-1 text-sm leading-relaxed text-muted">{v}</dd>
              </div>
            ))}
          </dl>
        </Card>
        <Card id="status" className="scroll-mt-24 p-7 lg:col-span-2">
          <h2 className="font-mono text-xs uppercase tracking-widest text-verified">What is real today</h2>
          <ul className="mt-6 divide-y divide-line border-y border-line">
            {STATUS.map(([k, s]) => (
              <li key={k} className="flex items-center justify-between gap-4 py-3.5 text-sm">
                <span>{k}</span>
                <Badge tone={tone[s]}>{label[s]}</Badge>
              </li>
            ))}
          </ul>
        </Card>
      </Container>
    </>
  );
}
