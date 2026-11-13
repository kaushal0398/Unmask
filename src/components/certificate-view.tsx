"use client";

import { ArrowLeft, Loader2 } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Badge, ButtonLink, Card, Mono } from "@/components/ui";
import { getApi } from "@/lib/api";
import type { Result } from "@/lib/api/types";
import type { Launch } from "@/lib/demo";
import { shortHash, tokens, usd } from "@/lib/format";
import { NEAR_EXPLORER, viewCall } from "@/lib/near-rpc";

const SCHEMA = "result-certificate/1";
const ALGORITHM = "uniform-price-v1";

type State =
  | { kind: "loading" }
  | { kind: "missing" }
  | { kind: "ready"; launch: Launch; result: Result | null }
  | { kind: "error"; message: string };

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-1 border-b border-line/60 py-3 sm:grid-cols-[14rem_1fr] sm:gap-4">
      <dt className="text-sm text-muted">{label}</dt>
      <dd className="min-w-0 break-all text-sm">{children}</dd>
    </div>
  );
}

type Anchor = { input_hash: string; output_hash: string; code_hash: string; clearing_price: string; block_height: string };

/** Reads the anchor back from the registry contract and compares it with the published result. */
function AnchorRow({ r }: { r: Result }) {
  const a = r.anchor;
  const [state, setState] = useState<"checking" | "match" | "mismatch" | "unreadable">("checking");
  useEffect(() => {
    if (!a) return;
    let live = true;
    viewCall<Anchor | null>(a.contract, "get_anchor", { launch_id: r.launchId })
      .then((c) => {
        if (!live) return;
        setState(c && c.input_hash === r.inputHash && c.code_hash === r.codeHash && c.output_hash === r.attestation.resultHash ? "match" : "mismatch");
      })
      .catch(() => live && setState("unreadable"));
    return () => { live = false; };
  }, [a, r]);

  if (!a) return <>Not anchored on-chain: no NEAR transaction records this result.</>;
  return (
    <>
      <a href={`${NEAR_EXPLORER}/txns/${a.txHash}`} target="_blank" rel="noreferrer" className="text-price underline underline-offset-4"><Mono>{a.txHash}</Mono></a>
      <span className="mt-1 block text-xs text-faint">
        Records the input, output and code hashes and the clearing price in the registry contract <Mono>{a.contract}</Mono>. It does not move tokens or funds.{" "}
        {state === "checking" ? "Checking the contract…" : state === "match" ? "The contract's stored hashes match this result." : state === "mismatch" ? "WARNING: the contract's stored hashes do NOT match this result." : "The contract could not be read just now."}
      </span>
    </>
  );
}

/** Every value comes from the backend's published result. Where something does not exist, the page says so. */
export function CertificateView({ id }: { id: string }) {
  const [state, setState] = useState<State>({ kind: "loading" });

  useEffect(() => {
    let live = true;
    (async () => {
      try {
        const api = getApi();
        const launch = await api.getLaunch(id);
        if (!live) return;
        if (!launch) return setState({ kind: "missing" });
        const result = await api.getResult(id);
        if (live) setState({ kind: "ready", launch, result });
      } catch (e) {
        if (live) setState({ kind: "error", message: e instanceof Error ? e.message : "Could not load the certificate." });
      }
    })();
    return () => { live = false; };
  }, [id]);

  if (state.kind === "loading") return <p className="flex items-center justify-center gap-2 py-16 text-muted"><Loader2 className="size-4 animate-spin" /> Loading…</p>;
  if (state.kind === "missing") return <p className="py-16 text-center text-muted">Launch not found.</p>;
  if (state.kind === "error") return <p className="py-16 text-center text-danger" role="alert">{state.message}</p>;

  const { launch: l, result: r } = state;
  const attested = r?.mode === "tee";

  return (
    <div className="space-y-6">
      <Link href={`/launches/${encodeURIComponent(l.id)}`} className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-text">
        <ArrowLeft className="size-4" /> {l.name}
      </Link>

      <div>
        <p className="text-xs uppercase tracking-[0.2em] text-verified">Auction Result Certificate</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">{l.name} <span className="font-mono text-muted">${l.symbol}</span></h1>
        <div className="mt-3 flex flex-wrap gap-2">
          <Badge tone={r ? "verified" : "neutral"}>{r ? "Settled" : "Not settled yet"}</Badge>
          <Badge tone={attested ? "verified" : "danger"}>{attested ? "TEE attestation verified" : "TEE attestation: not verified"}</Badge>
        </div>
      </div>

      {!r ? (
        <Card className="p-6 text-sm text-muted">No result has been published, so there is nothing to certify. This page will not invent one.</Card>
      ) : (
        <>
          <Card className="p-6">
            <h2 className="font-semibold">Result</h2>
            <dl className="mt-2">
              <Row label="Launch ID"><Mono>{r.launchId}</Mono></Row>
              <Row label="Supply offered"><Mono>{tokens(l.supply)} {l.symbol}</Mono></Row>
              <Row label="Reserve price"><Mono>{usd(l.reserve)}</Mono></Row>
              <Row label="Uniform clearing price"><Mono>{usd(r.clearingPrice)}</Mono></Row>
              <Row label="Sold / unsold"><Mono>{tokens(r.sold)} / {tokens(r.unsold)}</Mono></Row>
              <Row label="Raised"><Mono>{usd(r.raised)}</Mono></Row>
              <Row label="Bids received"><Mono>{r.totalBids}</Mono>{r.skipped?.length ? ` (${r.skipped.length} left out, with reasons on the result page)` : ""}</Row>
              <Row label="Settled at">{new Date(r.settledAt).toLocaleString()}</Row>
            </dl>
          </Card>

          <Card className="p-6">
            <h2 className="font-semibold">Code and input identity</h2>
            <dl className="mt-2">
              <Row label="Algorithm"><Mono>{ALGORITHM}</Mono></Row>
              <Row label="Auction engine (WASM) hash"><Mono>{r.codeHash}</Mono></Row>
              <Row label="Input hash"><Mono>{r.inputHash}</Mono></Row>
              <Row label="Output hash"><Mono>{r.attestation.resultHash}</Mono></Row>
              <Row label="Token contract"><Mono>{l.tokenContract || "not recorded"}</Mono></Row>
              <Row label="Certificate schema"><Mono>{SCHEMA}</Mono></Row>
            </dl>
          </Card>

          <Card className="p-6">
            <h2 className="font-semibold">Execution verification</h2>
            <dl className="mt-2">
              <Row label="Execution environment">{r.mode === "tee" ? "TEE (attestation verified)" : r.mode === "outlayer" ? "OutLayer" : "Development enclave"}</Row>
              <Row label="TEE attestation">
                {attested ? <Mono>{shortHash(r.attestation.quote, 12, 8)}</Mono>
                  : r.mode === "outlayer" && r.attestationUrl ? <>Returned by OutLayer, <a href={r.attestationUrl} target="_blank" rel="noreferrer" className="text-price underline underline-offset-4">not verified by us</a></>
                  : "Not available for this run"}
              </Row>
              <Row label="Bids private while open?">Sealed in the browser to the enclave key. {r.mode === "tee" ? "" : "Not guaranteed against the backend: the development enclave is not confidential."}</Row>
              <Row label="Result anchored on-chain"><AnchorRow r={r} /></Row>
              <Row label="Token and refund transfers">{r.payoutsExecuted ? "Executed" : "Planned only: no token or refund transfer has been sent"}</Row>
            </dl>
            <p className="mt-4 text-xs leading-relaxed text-faint">
              This is an ordinary server-published result. It is called a TEE certificate only if the attestation above is verified.
              To check it yourself, re-run the auction on the published bids.
            </p>
            <ButtonLink href={`/verify?launch=${encodeURIComponent(l.id)}`} tone="primary" className="mt-4">Re-run and verify</ButtonLink>
          </Card>
        </>
      )}
    </div>
  );
}
