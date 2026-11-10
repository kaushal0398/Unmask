"use client";

import { Bot, ExternalLink, Loader2, ShieldCheck } from "lucide-react";
import { useEffect, useState } from "react";
import { ResultCard } from "@/components/result-card";
import { useToast } from "@/components/toast";
import { useWallet } from "@/components/wallet";
import { Badge, Button, ButtonLink, Card, Mono, Stat } from "@/components/ui";
import { getApi } from "@/lib/api";
import { ApiError, type Result } from "@/lib/api/types";
import { compact, shortHash, tokens, usd } from "@/lib/format";
import { cardFor } from "@/lib/result-card";

type State = { kind: "loading" } | { kind: "none" } | { kind: "ready"; result: Result } | { kind: "error"; message: string };

const CHAIN_NAME: Record<string, string> = { near: "NEAR", eth: "Ethereum", base: "Base", arb: "Arbitrum", sol: "Solana" };
const short = (a: string) => (a.length > 22 ? `${a.slice(0, 10)}…${a.slice(-6)}` : a);

/**
 * The result of a launch settled by the backend: the one price, every allocation, your own result card, where
 * refunds and tokens would go, and what the evidence is (and is not). Nothing on this page is invented: if the
 * backend has no result yet it says so, and the creator can ask it to settle.
 */
export function BackendResult({ launch }: { launch: { id: string; symbol: string; creator: string; supply: number } }) {
  const { account, auth } = useWallet();
  const toast = useToast();
  const [state, setState] = useState<State>({ kind: "loading" });
  const [settling, setSettling] = useState(false);

  useEffect(() => {
    let live = true;
    getApi()
      .getResult(launch.id)
      .then((result) => live && setState(result ? { kind: "ready", result } : { kind: "none" }))
      .catch((e) => live && setState({ kind: "error", message: e instanceof Error ? e.message : "Could not load the result." }));
    return () => { live = false; };
  }, [launch.id]);

  async function settle() {
    setSettling(true);
    try {
      const result = await getApi(auth?.token).settleLaunch(launch.id);
      setState({ kind: "ready", result });
      toast("Settled. The result is below.", "ok");
    } catch (e) {
      toast(e instanceof ApiError || e instanceof Error ? e.message : "Could not settle this launch.", "error");
    } finally {
      setSettling(false);
    }
  }

  if (state.kind === "loading") return <p className="flex items-center justify-center gap-2 py-16 text-muted"><Loader2 className="size-4 animate-spin" /> Loading the result…</p>;
  if (state.kind === "error") return <p className="py-16 text-center text-danger" role="alert">{state.message}</p>;

  if (state.kind === "none") {
    const isCreator = Boolean(account && account === launch.creator && auth?.token);
    return (
      <Card className="p-6 sm:p-10">
        <p className="text-xs uppercase tracking-widest text-verified">Bidding closed</p>
        <h2 className="mt-1 text-2xl font-semibold">No more bids are accepted.</h2>
        <p className="mt-4 max-w-xl text-sm leading-relaxed text-muted">The result is published once the launch is settled. Until then there is no clearing price and no allocation to show, and this page will not invent one.</p>
        {isCreator ? (
          <Button type="button" tone="seal" className="mt-6" onClick={() => void settle()} disabled={settling}>
            {settling ? <Loader2 className="size-4 animate-spin" /> : <ShieldCheck className="size-4" />} Settle this launch
          </Button>
        ) : (
          <p className="mt-6 text-xs text-faint">Only the creator ({launch.creator}) can settle it.</p>
        )}
      </Card>
    );
  }

  const r = state.result;
  const mine = account ? cardFor(r, launch.symbol, account) : null;
  const planned = r.payouts ?? [];
  const skipped = r.skipped ?? [];
  const agentCount = r.allocations.filter((a) => a.agent).length;

  return (
    <div className="space-y-8">
      <Card className="p-6 sm:p-10">
        <div className="grid gap-8 lg:grid-cols-[1.2fr_1fr] lg:items-end">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-verified">Cleared at one price for everyone</p>
            <p className="mt-3 font-mono text-6xl font-medium tabular-nums tracking-tight sm:text-8xl">{usd(r.clearingPrice)}</p>
            <p className="mt-3 text-muted">per {launch.symbol}. Whatever they offered, every winner paid exactly this.</p>
          </div>
          <dl className="grid grid-cols-3 gap-4">
            <Stat label="Raised" value={usd(r.raised, { compact: true })} tone="verified" />
            <Stat label="Sold" value={`${Math.round((r.sold / launch.supply) * 100)}%`} hint={`${tokens(r.sold)} tokens`} />
            <Stat label="Bids" value={String(r.totalBids)} hint={skipped.length ? `${skipped.length} left out` : agentCount ? `${agentCount} by agents` : "all counted"} />
          </dl>
        </div>
      </Card>

      {mine && <ResultCard card={mine} />}

      <div>
        <h2 className="text-2xl font-semibold tracking-tight">Every allocation</h2>
        <p className="mt-2 max-w-2xl text-sm text-muted">The sealed bids are opened after settlement. Anyone can re-run the rule on these numbers.</p>
        <div className="mt-5 overflow-x-auto" tabIndex={0} role="region" aria-label="Allocations table">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="border-b border-line text-left text-xs uppercase tracking-wider text-faint">
                <th className="py-2.5 pr-3 font-medium">Bidder</th>
                <th className="px-3 py-2.5 text-right font-medium">Limit</th>
                <th className="px-3 py-2.5 text-right font-medium">Wanted</th>
                <th className="px-3 py-2.5 text-right font-medium">Got</th>
                <th className="px-3 py-2.5 text-right font-medium">Paid</th>
                <th className="py-2.5 pl-3 text-right font-medium">Refunded</th>
              </tr>
            </thead>
            <tbody>
              {r.allocations.map((a) => (
                <tr key={a.bidder} className={`border-b border-line/60 ${a.bidder === account ? "bg-white/5" : a.filled > 0 ? "bg-verified/5" : ""}`}>
                  <td className="py-2.5 pr-3 font-mono text-[13px]">
                    {a.bidder}
                    {a.agent && <span className="ml-2 inline-flex items-center gap-1 border border-near/50 px-1.5 py-0.5 font-sans text-[10px] text-near"><Bot className="size-3" /> agent{a.agent.signed ? " · signed" : ""}</span>}
                  </td>
                  <td className="px-3 py-2.5 text-right"><Mono>{usd(a.limit)}</Mono></td>
                  <td className="px-3 py-2.5 text-right"><Mono>{tokens(a.qty)}</Mono></td>
                  <td className={`px-3 py-2.5 text-right ${a.filled > 0 ? "text-verified" : ""}`}><Mono>{tokens(a.filled)}</Mono></td>
                  <td className="px-3 py-2.5 text-right"><Mono>{usd(a.paid)}</Mono></td>
                  <td className="py-2.5 pl-3 text-right"><Mono className="text-muted">{usd(a.refund)}</Mono></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {planned.length > 0 && (
        <Card className="p-6 sm:p-8">
          <h3 className="text-lg font-semibold">Where the money and tokens go</h3>
          <p className="mt-2 max-w-2xl text-sm text-muted">Each bidder picks this when they bid, sealed inside the bid. This is the plan. {r.payoutsExecuted ? "" : "No transfers have been made: real payment checks and the token come next."}</p>
          <ul className="mt-5 divide-y divide-line text-sm">
            {planned.map((t) => (
              <li key={`${t.bidId}-${t.kind}`} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <span className="flex items-center gap-2">
                  <Badge tone={t.kind === "refund" ? "neutral" : "verified"}>{t.kind === "refund" ? "refund" : "tokens"}</Badge>
                  <Mono>{t.bidder}</Mono>
                </span>
                <span className="flex items-center gap-2 text-muted">
                  <Mono>{t.kind === "refund" ? usd(Number(t.amountAtomic) / 1e6) : `${tokens(Number(t.amountAtomic))} ${launch.symbol}`}</Mono>
                  <span aria-hidden>→</span>
                  <span>{CHAIN_NAME[t.to.chain] ?? t.to.chain}</span>
                  <Mono>{short(t.to.address)}</Mono>
                  {t.viaIntents && <Badge tone="seal">via NEAR Intents</Badge>}
                </span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {skipped.length > 0 && (
        <Card className="p-6 sm:p-8">
          <h3 className="text-lg font-semibold">Bids left out</h3>
          <p className="mt-2 max-w-2xl text-sm text-muted">These were not counted, and each has a reason. Their funds come back through the payment check.</p>
          <ul className="mt-4 space-y-2 text-sm">{skipped.map((s) => <li key={s.bidId} className="flex flex-wrap gap-3"><Mono className="text-faint">{shortHash(s.bidId, 6, 4)}</Mono><span className="text-muted">{s.reason}</span></li>)}</ul>
        </Card>
      )}

      <Card className="p-6 sm:p-8">
        <div className="flex flex-wrap items-center justify-between gap-5">
          <div className="max-w-xl">
            <h3 className="flex items-center gap-2 text-lg font-semibold"><ShieldCheck className="size-5 text-verified" /> Check it yourself</h3>
            <p className="mt-2 text-sm text-muted">The code hash and the hash of the exact input are public. {r.mode === "tee" ? "The attestation ties them to the enclave." : r.mode === "outlayer" ? "This ran on OutLayer, which returned an attestation. We have not verified it, so do not read this as proof yet: check it with outlayer-verify. The backend could still read the bids before they reached OutLayer." : "This was settled by the development enclave: you can reproduce the result, but nothing here is attested and the backend could read the bids."}</p>
            <dl className="mt-4 space-y-1.5 text-xs">
              <div className="flex gap-3"><dt className="w-24 text-faint">Code hash</dt><dd><Mono>{shortHash(r.codeHash, 12, 8)}</Mono></dd></div>
              <div className="flex gap-3"><dt className="w-24 text-faint">Input hash</dt><dd><Mono>{shortHash(r.inputHash, 12, 8)}</Mono></dd></div>
              <div className="flex gap-3"><dt className="w-24 text-faint">Output hash</dt><dd><Mono>{shortHash(r.attestation.resultHash, 12, 8)}</Mono></dd></div>
              <div className="flex gap-3"><dt className="w-24 text-faint">Attestation</dt><dd>{r.mode === "tee" ? <Mono>{shortHash(r.attestation.quote, 12, 8)}</Mono> : r.mode === "outlayer" && r.attestationUrl ? <a href={r.attestationUrl} className="text-price underline underline-offset-4" target="_blank" rel="noreferrer">returned by OutLayer, not verified by us</a> : <span className="text-price">none (development enclave)</span>}</dd></div>
              <div className="flex gap-3"><dt className="w-24 text-faint">Total</dt><dd className="text-muted">{compact(r.totalBids)} bids, {r.allocations.length} counted</dd></div>
            </dl>
          </div>
          <ButtonLink href={`/verify?launch=${launch.id}`} tone="primary">Verify this launch <ExternalLink className="size-4" /></ButtonLink>
        </div>
      </Card>
    </div>
  );
}
