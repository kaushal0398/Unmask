
"use client";

import { useEffect, useState } from "react";
import { LaunchGrid } from "@/components/launch-grid";
import { PageHeader } from "@/components/page-header";
import { ButtonLink, Container, Stat } from "@/components/ui";
import { getApi } from "@/lib/api";
import type { Launch } from "@/lib/demo";
import { compact } from "@/lib/format";

export default function LaunchesPage() {
  const [launches, setLaunches] = useState<Launch[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    getApi()
      .listLaunches()
      .then((data) => {
        if (active) setLaunches(data as Launch[]);
      })
      .catch((err) => {
        if (active) {
          setError(err instanceof Error ? err.message : "Could not load launches.");
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  const open = launches.filter((l) => l.status === "open").length;
  const settled = launches.filter((l) => l.status === "settled").length;
  const bids = launches.reduce((sum, l) => sum + l.bidCount, 0);

  const boxes = [
    { label: "Launches", value: String(launches.length) },
    { label: "Taking bids now", value: String(open), tone: "seal" as const },
    { label: "Sealed bids", value: compact(bids) },
    { label: "Settled and verifiable", value: String(settled), tone: "verified" as const },
  ];

  return (
    <>
      <PageHeader eyebrow="Launches" title="Every bid sealed. Every price the same." demo>
        Open one to bid in secret, or look at a settled launch and check how it was run.
      </PageHeader>

      <Container className="py-12 sm:py-16">
        <dl className="grid grid-cols-2 gap-px border border-line-strong bg-line-strong shadow-[0_30px_60px_-30px_rgb(0_0_0/0.9)] lg:grid-cols-4">
          {boxes.map((b) => (
            <Stat key={b.label} className="bg-surface p-6" label={b.label} value={b.value} tone={b.tone} />
          ))}
        </dl>

        <div className="mt-12 flex flex-wrap items-center justify-between gap-4">
          <p className="text-sm text-muted">Pick a coin, seal a bid.</p>
          <ButtonLink href="/launches/new" tone="seal">Create a launch</ButtonLink>
        </div>

        <div className="mt-6">
          {loading ? (
            <p className="py-10 text-center text-sm text-muted">Loading launches...</p>
          ) : error ? (
            <p className="py-10 text-center text-sm text-red-400">{error}</p>
          ) : (
            <LaunchGrid launches={launches} />
          )}
        </div>
      </Container>
    </>
  );
}
