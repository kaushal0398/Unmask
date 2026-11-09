import type { Metadata } from "next";
import { Plus } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { ButtonLink, Container } from "@/components/ui";

export const metadata: Metadata = { title: "FAQ" };

const FAQ: Array<[string, string]> = [
  ["What is a sealed-bid launch?", "Buyers send in bids that nobody can read, for a fixed window. When it closes, one price is found and everyone who wins pays it. There is no price moving while people buy, so there is nothing to race for."],
  ["Why can't a bot snipe it?", "Sniping works by being first and by seeing what others do. Here the order you arrive in does not matter, and no amount is visible until the close. A bot can still bid, but it gets the same price as everyone else."],
  ["Can the creator see the bids?", "No. Bids are encrypted so only the enclave can read them. The creator sees the number of bids, like everyone else, and the result after the close."],
  ["What do I actually pay?", "The clearing price for the tokens you win, not your own limit. If you offered $0.05 and the price clears at $0.03, you pay $0.03. Whatever you locked beyond that comes back."],
  ["What if I lose?", "You get everything back. A bid below the clearing price wins nothing and is refunded in full."],
  ["What is a payment check?", "A pot of funds you lock for your bid, at most what you could owe. It sits in its own account and needs no gas. You can withdraw it before the close, which cancels your bid."],
  ["Do I have to trust you?", "That is what the verify page is for. The auction runs in an enclave whose code is public, and it signs what it did. Anyone can recompute the hashes, re-run the rule on the bids and check the transfers."],
  ["What is an enclave?", "A locked box inside a processor. Code runs in it and the machine's owner cannot look inside or change it. Its hardware can sign a statement about exactly which code ran."],
  ["Does this stop whales or many wallets?", "No. It removes the timing and visibility advantage, not the wealth advantage. A cap per account helps a little, but one person with many wallets looks like many people."],
  ["Is this real money?", "Not yet. Every launch, bid and result on this site is demo data. The interface shows how the real flow will work."],
  ["Is this financial advice?", "No. Nothing here promises a price, liquidity or a return. Token launches can be regulated where you live."],
];

export default function FaqPage() {
  return (
    <>
      <PageHeader eyebrow="FAQ" title="Questions people ask before they bid.">Short answers. The long ones are on the how-it-works page.</PageHeader>
      <Container className="py-14 sm:py-20">
        <div className="max-w-3xl border border-line-strong bg-line-strong shadow-[0_30px_60px_-30px_rgb(0_0_0/0.9)]">
          {FAQ.map(([q, a], i) => (
            <details key={q} className="group border-b border-line bg-surface last:border-b-0 open:bg-raised">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-6 p-6 text-left [&::-webkit-details-marker]:hidden">
                <span className="flex items-baseline gap-4"><span className="font-mono text-xs text-faint">{String(i + 1).padStart(2, "0")}</span><span className="font-medium">{q}</span></span>
                <Plus className="size-5 shrink-0 text-faint transition-transform group-open:rotate-45 group-open:text-seal-fg" />
              </summary>
              <p className="px-6 pb-6 pl-[4.25rem] text-sm leading-relaxed text-muted">{a}</p>
            </details>
          ))}
        </div>
        <div className="mt-10 flex flex-wrap gap-3">
          <ButtonLink href="/how-it-works" tone="seal">How it works</ButtonLink>
          <ButtonLink href="/verify" tone="ghost">Check a launch</ButtonLink>
        </div>
      </Container>
    </>
  );
}
