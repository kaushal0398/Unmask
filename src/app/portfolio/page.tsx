import type { Metadata } from "next";
import { PageHeader } from "@/components/page-header";
import { Container } from "@/components/ui";
import { PortfolioView } from "@/components/portfolio-view";

export const metadata: Metadata = { title: "My bids" };

export default function PortfolioPage() {
  return (
    <>
      <PageHeader eyebrow="My bids" title="Everything you locked, won and got back.">Connect a wallet to see your bids.</PageHeader>
      <Container className="py-14 sm:py-20"><PortfolioView /></Container>
    </>
  );
}
