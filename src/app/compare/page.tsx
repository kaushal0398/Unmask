import type { Metadata } from "next";
import { CompareLab } from "@/components/compare-lab";
import { PageHeader } from "@/components/page-header";
import { RaceDemo } from "@/components/race-demo";
import { Container, Emph, SectionHeading } from "@/components/ui";

export const metadata: Metadata = { title: "Sealed vs first-come" };

export default function ComparePage() {
  return (
    <>
      <PageHeader eyebrow="Compare" title={<>The same buyers. <Emph>Two</Emph> kinds of launch.</>} demo>
        Watch what happens to the supply when the fastest buyer goes first, and when it does not matter who is first.
      </PageHeader>
      <section className="py-14 sm:py-20"><Container><RaceDemo /></Container></section>
      <section className="border-t border-line py-14 sm:py-20">
        <Container>
          <SectionHeading eyebrow="Try it" title="Turn the bots up.">Add bot wallets, or let them pay more, and see who ends up with the tokens on each side.</SectionHeading>
          <div className="mt-10"><CompareLab /></div>
        </Container>
      </section>
    </>
  );
}
