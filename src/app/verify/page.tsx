import type { Metadata } from "next";
import { Suspense } from "react";
import { Container, DemoNote, Eyebrow } from "@/components/ui";
import { VerifyPanel } from "@/components/verify-panel";
import { LAUNCHES } from "@/lib/demo";

export const metadata: Metadata = { title: "Verify a launch" };

export default function VerifyPage() {
  const settled = LAUNCHES.filter((l) => l.status === "settled");
  return (
    <Container className="py-14 sm:py-20">
      <Eyebrow tone="verified">Verify</Eyebrow>
      <h1 className="mt-3 max-w-2xl text-4xl font-semibold tracking-tight text-balance sm:text-5xl">Don&apos;t trust us. Check.</h1>
      <p className="mt-4 max-w-xl text-muted">Five checks, each one redone in your browser from the published numbers. If one fails, so does the launch.</p>
      <div className="mt-5"><DemoNote /></div>
      <div className="mt-10">
        <Suspense fallback={<div className="h-96 rounded-none shimmer" />}>
          <VerifyPanel launches={settled} />
        </Suspense>
      </div>
    </Container>
  );
}
