"use client";

import { Button, ButtonLink, Container } from "@/components/ui";

export default function ErrorPage({ reset }: { error: Error; reset: () => void }) {
  return (
    <Container className="py-24 text-center">
      <p className="font-mono text-xs uppercase tracking-widest text-danger">Something broke</p>
      <h1 className="mt-4 text-4xl font-semibold tracking-tight">That page did not load.</h1>
      <p className="mx-auto mt-4 max-w-md text-muted">Nothing was lost: no bid was sent and no funds moved. Try again, or go back to the launches.</p>
      <div className="mt-8 flex justify-center gap-3">
        <Button tone="seal" onClick={reset}>Try again</Button>
        <ButtonLink href="/launches" tone="ghost">All launches</ButtonLink>
      </div>
    </Container>
  );
}
