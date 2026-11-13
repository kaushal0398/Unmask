"use client";

import { ArrowLeft, Loader2 } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Badge, Card, Mono } from "@/components/ui";
import { getApi } from "@/lib/api";
import type { Launch } from "@/lib/demo";
import { usd } from "@/lib/format";

type Severity = "info" | "low" | "medium" | "high" | "unknown";
type Basis = "verified" | "heuristic" | "unknown";
type Finding = { id: string; title: string; severity: Severity; basis: Basis; detail: string; evidence: string };

const RULES_VERSION = "passport-rules/1";

/** Deterministic checks over the launch record. Anything we cannot read is reported "unknown", never guessed. */
export function checksFor(l: Launch): Finding[] {
  const out: Finding[] = [];
  const capShare = l.cap;

  out.push(
    l.reserve > 0
      ? { id: "reserve", title: "Reserve price set", severity: "info", basis: "verified", detail: "Bids below the reserve are excluded.", evidence: `reserve = ${usd(l.reserve)} (launch record)` }
      : { id: "reserve", title: "No reserve price", severity: "medium", basis: "verified", detail: "Without a reserve the whole supply could clear at a near-zero price.", evidence: "reserve = 0 (launch record)" },
  );

  if (capShare === null) {
    out.push({ id: "cap", title: "No per-account cap", severity: "medium", basis: "verified", detail: "One wallet, or many wallets it controls, can take any share of the supply.", evidence: "cap = none (launch record)" });
  } else if (capShare > 0.25) {
    out.push({ id: "cap", title: "High per-account cap", severity: "medium", basis: "verified", detail: `One account may take up to ${Math.round(capShare * 100)}% of supply.`, evidence: `cap = ${capShare * 100}% (launch record)` });
  } else {
    out.push({ id: "cap", title: "Per-account cap limits concentration", severity: "info", basis: "verified", detail: `Up to ${Math.round(capShare * 100)}% per account. A cap does not stop one person using several wallets.`, evidence: `cap = ${capShare * 100}% (launch record)` });
  }

  out.push(
    l.codeHash
      ? { id: "code", title: "Auction code hash published", severity: "info", basis: "verified", detail: "The auction engine identity is recorded before bids are accepted.", evidence: `codeHash = ${l.codeHash}` }
      : { id: "code", title: "No auction code hash", severity: "high", basis: "verified", detail: "Participants cannot tell which code will compute the result.", evidence: "codeHash missing (launch record)" },
  );

  out.push(
    l.tokenContract
      ? { id: "contract", title: "Token contract recorded", severity: "info", basis: "verified", detail: "A contract address is attached to this launch.", evidence: `tokenContract = ${l.tokenContract}` }
      : { id: "contract", title: "No token contract recorded", severity: "high", basis: "verified", detail: "There is no contract to inspect.", evidence: "tokenContract missing (launch record)" },
  );

  // Not implemented yet: said plainly instead of passing silently.
  for (const [id, title] of [
    ["mint", "Mint, pause and freeze authority"],
    ["upgrade", "Contract upgrade authority"],
    ["holders", "Holder concentration"],
    ["creator", "Creator wallet history"],
    ["liquidity", "Liquidity setup and lock"],
  ] as const) {
    out.push({ id, title, severity: "unknown", basis: "unknown", detail: "This check has not been implemented, so no claim is made either way.", evidence: "No on-chain query was run" });
  }
  return out;
}

export function bandOf(f: Finding[]): "Low" | "Medium" | "High" {
  if (f.some((x) => x.severity === "high")) return "High";
  if (f.some((x) => x.severity === "medium")) return "Medium";
  return "Low";
}

const tone = (s: Severity) => (s === "high" ? "danger" : s === "medium" ? "seal" : s === "info" || s === "low" ? "verified" : "neutral");

export function PassportView({ id }: { id: string }) {
  const [launch, setLaunch] = useState<Launch | null | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const [reviewedAt] = useState(() => new Date());

  useEffect(() => {
    let live = true;
    getApi().getLaunch(id).then((l) => live && setLaunch(l)).catch((e) => live && setError(e instanceof Error ? e.message : "Could not load the launch."));
    return () => { live = false; };
  }, [id]);

  if (error) return <p className="py-16 text-center text-danger" role="alert">{error}</p>;
  if (launch === undefined) return <p className="flex items-center justify-center gap-2 py-16 text-muted"><Loader2 className="size-4 animate-spin" /> Loading…</p>;
  if (!launch) return <p className="py-16 text-center text-muted">Launch not found.</p>;

  const findings = checksFor(launch);
  const band = bandOf(findings);
  const unknowns = findings.filter((f) => f.severity === "unknown").length;

  return (
    <div className="space-y-6">
      <Link href={`/launches/${encodeURIComponent(launch.id)}`} className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-text">
        <ArrowLeft className="size-4" /> {launch.name}
      </Link>
      <div>
        <p className="text-xs uppercase tracking-[0.2em] text-seal-fg">Launch Risk Passport</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">{launch.name} <span className="font-mono text-muted">${launch.symbol}</span></h1>
        <div className="mt-3 flex flex-wrap gap-2">
          <Badge tone={band === "High" ? "danger" : band === "Medium" ? "seal" : "verified"}>Risk on checks run: {band}</Badge>
          <Badge>{unknowns} checks not run</Badge>
        </div>
        <p className="mt-3 max-w-2xl text-sm text-muted">
          Based only on the checks below. A &quot;Low&quot; band does not mean safe: {unknowns} checks have not been implemented yet. This is not a security audit.
        </p>
      </div>

      <div className="space-y-3">
        {findings.map((f) => (
          <Card key={f.id} className="p-5">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone={tone(f.severity)}>{f.severity}</Badge>
              <Badge>{f.basis === "verified" ? "verified fact" : f.basis === "heuristic" ? "heuristic" : "unknown"}</Badge>
              <h2 className="font-semibold">{f.title}</h2>
            </div>
            <p className="mt-2 text-sm text-muted">{f.detail}</p>
            <p className="mt-2 text-xs text-faint">Evidence: <Mono className="break-all">{f.evidence}</Mono></p>
          </Card>
        ))}
      </div>

      <p className="text-xs text-faint">Reviewed {reviewedAt.toLocaleString()} · rules {RULES_VERSION} · no AI model was used for these findings.</p>
    </div>
  );
}
