import type { Metadata } from "next";
import { Check } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { ButtonLink, Card, Container, Emph } from "@/components/ui";

export const metadata: Metadata = { title: "For creators" };

const SET = [
  ["Token", "Name, symbol, and how many tokens are for sale."],
  ["Reserve price", "The lowest price you will sell at. Bids under it are out."],
  ["Bidding window", "From 15 minutes to a day."],
  ["Cap per account", "Optional. Makes one wallet less decisive."],
  ["If it does not sell out", "Take the unsold tokens back, or burn them. Chosen now, not after you see the bids."],
];

const GET = [
  "A price found by demand, not guessed by you.",
  "A launch where your community is not front-run.",
  "Proceeds sent to you at settlement.",
  "A proof page you can point people to.",
];

export default function CreatorsPage() {
  return (
    <>
      <PageHeader eyebrow="For creators" title={<>Launch to your community, not to the <Emph>fastest bot</Emph>.</>}>
        You set the rules once. The auction runs itself, and you cannot see the bids either.
      </PageHeader>
      <Container className="grid gap-8 py-14 sm:py-20 lg:grid-cols-2">
        <Card className="p-7">
          <h2 className="font-mono text-xs uppercase tracking-widest text-seal">What you set</h2>
          <dl className="mt-6 divide-y divide-line border-y border-line">
            {SET.map(([k, v]) => (
              <div key={k} className="py-4"><dt className="text-sm font-medium">{k}</dt><dd className="mt-1 text-sm text-muted">{v}</dd></div>
            ))}
          </dl>
        </Card>
        <Card className="p-7">
          <h2 className="font-mono text-xs uppercase tracking-widest text-verified">What you get</h2>
          <ul className="mt-6 space-y-4">
            {GET.map((g) => <li key={g} className="flex gap-3 text-sm text-muted"><Check className="mt-0.5 size-4 shrink-0 text-verified" />{g}</li>)}
          </ul>
          <p className="mt-8 border-t border-line pt-6 text-xs leading-relaxed text-faint">It will not make a coin succeed. It removes one unfair advantage. A launch can still be small, and prices can still fall.</p>
          <div className="mt-6"><ButtonLink href="/launches/new" tone="seal">Create a launch</ButtonLink></div>
        </Card>
      </Container>
    </>
  );
}
