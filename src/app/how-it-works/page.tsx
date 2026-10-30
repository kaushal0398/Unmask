import type { Metadata } from "next";
import { ClearStepArt, SealStepArt, VerifyStepArt, WaitStepArt } from "@/components/art";
import { PageHeader } from "@/components/page-header";
import { ButtonLink, Card, Container, Emph, Mono } from "@/components/ui";
import { clearAuction, type Bid } from "@/lib/auction";
import { tokens, usd } from "@/lib/format";

export const metadata: Metadata = { title: "How it works" };

const EXAMPLE: Bid[] = [
  { id: "A", label: "A", limit: 0.05, qty: 400_000 },
  { id: "B", label: "B", limit: 0.04, qty: 300_000 },
  { id: "C", label: "C", limit: 0.03, qty: 300_000 },
  { id: "D", label: "D", limit: 0.02, qty: 200_000 },
];

const STEPS = [
  { Art: SealStepArt, tone: "text-seal", n: "01", title: "Create", who: "The creator", text: "Sets the token, how many tokens are for sale, a reserve price, the bidding window and an optional cap per account. These are fixed from this moment, so no one can bend them after seeing the bids." },
  { Art: SealStepArt, tone: "text-seal", n: "02", title: "Bid", who: "A buyer", text: "Chooses the most they'd pay per token and how many they want. The bid is encrypted so only the enclave can read it, and the most they could owe is locked in a payment check they control." },
  { Art: WaitStepArt, tone: "text-seal", n: "03", title: "Close", who: "The clock", text: "Bidding stops at the deadline. The public sees how many bids there are, never an amount. A buyer who changes their mind can withdraw their payment check, which only cancels their own bid." },
  { Art: ClearStepArt, tone: "text-verified", n: "04", title: "Clear", who: "The enclave", text: "Sorts the bids by limit price and fills them from the top until the supply is sold. The price of the last bid filled is the clearing price. Every winner pays it. Bids at that price share what is left pro-rata." },
  { Art: ClearStepArt, tone: "text-verified", n: "05", title: "Settle", who: "The enclave", text: "Sends tokens to winners, returns every unused amount to its bidder, and sends the proceeds to the creator. Nobody has to ask for a refund." },
  { Art: VerifyStepArt, tone: "text-verified", n: "06", title: "Verify", who: "Anyone", text: "The code hash, the input hash, the attestation and the result are published. Anyone can recompute them and check the transfers on chain." },
];

const GLOSSARY = [
  ["Sealed bid", "A bid no one can read until the auction closes: not other bidders, not the creator, not us."],
  ["Limit price", "The most a buyer is willing to pay per token. They will never pay more, and they may pay less."],
  ["Reserve price", "The lowest price the creator will sell at. Bids below it are not in the auction."],
  ["Clearing price", "The one price that sells the supply. Everyone who wins pays it."],
  ["Enclave (TEE)", "A locked box inside a processor. Code runs in it and even the machine's owner cannot look inside or change it."],
  ["Attestation", "A signature from the enclave's hardware saying which code ran and what it was given."],
  ["Payment check", "A pot of funds a bidder locks for their bid. It sits in its own account, needs no gas, and unused parts go back."],
] as const;

export default function HowItWorksPage() {
  const o = clearAuction(EXAMPLE, 1_000_000, 0.01);
  return (
    <>
      <PageHeader eyebrow="How it works" title={<>Six steps, and <Emph>nobody</Emph> to trust.</>}>
        A launch where the order you arrive in does not matter, no one can see an order book, and the result can be checked by anyone.
      </PageHeader>

      <section className="py-16 sm:py-24">
        <Container>
          <ol className="grid gap-px border border-line bg-line md:grid-cols-2 lg:grid-cols-3">
            {STEPS.map((s) => (
              <li key={s.n} className="bg-black p-6 sm:p-7">
                <div className="flex items-center justify-between font-mono text-xs text-faint">
                  <span>{s.n}</span>
                  <span className="border border-line-strong px-2 py-0.5">{s.who}</span>
                </div>
                <div className={`mt-5 ${s.tone}`}><div className="text-text"><s.Art /></div></div>
                <h2 className="mt-5 text-xl font-semibold tracking-tight">{s.title}</h2>
                <p className="mt-2 text-sm leading-relaxed text-muted">{s.text}</p>
              </li>
            ))}
          </ol>
        </Container>
      </section>

      <section id="rule" className="scroll-mt-20 border-t border-line py-16 sm:py-24">
        <Container>
          <div className="grid grid-cols-1 gap-12 lg:grid-cols-[0.9fr_1.1fr] [&>*]:min-w-0">
            <div>
              <p className="font-mono text-xs uppercase tracking-widest text-verified">The auction rule</p>
              <h2 className="mt-4 text-3xl font-semibold tracking-tight text-balance sm:text-4xl">Uniform price, found after the close.</h2>
              <ol className="mt-8 space-y-5 text-sm leading-relaxed text-muted">
                <li className="flex gap-4"><Mono className="text-seal">1</Mono><span>Sort bids by limit price, highest first.</span></li>
                <li className="flex gap-4"><Mono className="text-seal">2</Mono><span>Fill them in that order until the supply is sold.</span></li>
                <li className="flex gap-4"><Mono className="text-seal">3</Mono><span>The clearing price is the limit of the last bid filled, even partly. If demand at or above the reserve falls short of the supply, it is the reserve.</span></li>
                <li className="flex gap-4"><Mono className="text-seal">4</Mono><span>Every winner pays the clearing price for what they get, not their own limit.</span></li>
                <li className="flex gap-4"><Mono className="text-seal">5</Mono><span>Bids at the clearing price share what is left pro-rata. A bid below it wins nothing and is refunded in full.</span></li>
              </ol>
            </div>
            <Card className="p-0">
              <div className="border-b border-line p-5">
                <p className="text-sm font-medium">Worked example</p>
                <p className="mt-1 text-xs text-muted">{tokens(1_000_000)} tokens for sale, reserve {usd(0.01)}. Computed here by the same rule, not typed in.</p>
              </div>
              <div className="overflow-x-auto" tabIndex={0} role="region" aria-label="Scrollable table">
                <table className="w-full min-w-[480px] text-sm">
                  <thead>
                    <tr className="border-b border-line text-left text-xs uppercase tracking-wider text-faint">
                      <th className="px-5 py-3 font-medium">Bidder</th>
                      <th className="px-3 py-3 text-right font-medium">Limit</th>
                      <th className="px-3 py-3 text-right font-medium">Wants</th>
                      <th className="px-3 py-3 text-right font-medium">Gets</th>
                      <th className="px-5 py-3 text-right font-medium">Pays</th>
                    </tr>
                  </thead>
                  <tbody>
                    {o.fills.map((f) => (
                      <tr key={f.bid.id} className="border-b border-line/60">
                        <td className="px-5 py-3 font-mono">{f.bid.label}</td>
                        <td className="px-3 py-3 text-right"><Mono>{usd(f.bid.limit)}</Mono></td>
                        <td className="px-3 py-3 text-right"><Mono>{tokens(f.bid.qty)}</Mono></td>
                        <td className={`px-3 py-3 text-right ${f.filled ? "text-verified" : "text-faint"}`}><Mono>{f.filled ? tokens(f.filled) : "refunded"}</Mono></td>
                        <td className="px-5 py-3 text-right"><Mono>{usd(f.pays)}</Mono></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line bg-verified/5 p-5">
                <p className="text-sm">Clearing price <Mono className="font-semibold text-verified">{usd(o.price)}</Mono></p>
                <p className="text-sm text-muted">A pays {usd(o.fills[0]!.pays)}, not {usd(0.05 * 400_000)}. Proceeds {usd(o.raised)}.</p>
              </div>
            </Card>
          </div>
        </Container>
      </section>

      <section className="border-t border-line py-16 sm:py-24">
        <Container>
          <h2 className="text-3xl font-semibold tracking-tight">Words you will see</h2>
          <dl className="mt-10 grid gap-px border border-line bg-line sm:grid-cols-2">
            {GLOSSARY.map(([k, v]) => (
              <div key={k} className="bg-black p-6">
                <dt className="font-medium text-text">{k}</dt>
                <dd className="mt-2 text-sm leading-relaxed text-muted">{v}</dd>
              </div>
            ))}
          </dl>
          <div className="mt-12 flex flex-wrap gap-3">
            <ButtonLink href="/compare" tone="seal">See sealed vs first-come</ButtonLink>
            <ButtonLink href="/launches" tone="ghost">Browse launches</ButtonLink>
          </div>
        </Container>
      </section>
    </>
  );
}
