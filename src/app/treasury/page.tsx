import type { Metadata } from "next";
import { TreasuryView } from "@/components/treasury-view";
import { Container } from "@/components/ui";

export const metadata: Metadata = { title: "Treasury" };

export default function TreasuryPage() {
  return (
    <Container className="py-12 sm:py-16">
      <TreasuryView />
    </Container>
  );
}
