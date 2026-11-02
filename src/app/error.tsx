"use client";

import { Button, ButtonLink, Container } from "@/components/ui";

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <Container className="py-24 text-center">
      <p className="font-mono text-xs uppercase tracking-widest text-danger">
        Something broke
      </p>

      <h1 className="mt-4 text-4xl font-semibold tracking-tight">
        That page did not load.
      </h1>

      <p className="mx-auto mt-4 max-w-md text-muted">
        Something unexpected happened while loading this page.
      </p>

      {process.env.NODE_ENV === "development" && (
        <pre className="mx-auto mt-6 max-w-2xl overflow-auto border border-danger/30 bg-black p-4 text-left text-xs text-red-400">
          {error.message}
          {"\n\n"}
          {error.stack}
        </pre>
      )}

      {error.digest && (
        <p className="mt-3 text-xs text-faint">
          Error reference: {error.digest}
        </p>
      )}

      <div className="mt-8 flex justify-center gap-3">
        <Button tone="seal" onClick={reset}>
          Try again
        </Button>
        <ButtonLink href="/launches" tone="ghost">
          All launches
        </ButtonLink>
      </div>
    </Container>
  );
}