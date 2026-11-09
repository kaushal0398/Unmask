"use client";

import { ChevronDown, Loader2 } from "lucide-react";
import { useMemo, useState } from "react";
import { Button, Mono, cx } from "@/components/ui";
import { usd } from "@/lib/format";
import { addressProblem, isChain } from "@/lib/intents/addresses";
import { IntentsClient, IntentsError, chainOf, fundingOrigins, fundingRequest, summarizeQuote, type OneClickToken, type QuoteSummary } from "@/lib/intents/oneclick";

const API = (process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:4001").replace(/\/+$/, "");
/** Where the funds would land. NEAR Intents is mainnet only, so a testnet account cannot be used. */
const RECIPIENT = process.env.NEXT_PUBLIC_FUNDING_RECIPIENT ?? "unmask-funding.near";

const field = "w-full border border-line-strong bg-bg px-3 py-2 font-mono text-sm outline-none placeholder:text-faint focus:bg-white/[0.03] disabled:opacity-50";

const CHAIN_NAME: Record<string, string> = { near: "NEAR", eth: "Ethereum", base: "Base", arb: "Arbitrum", sol: "Solana" };

/**
 * Pay for a bid from another chain through NEAR Intents 1Click. This shows a real price quote for delivering the
 * USDC a bid needs; it is a dry run, so there is no deposit address and nothing to pay. A live deposit only exists
 * when the operator switches live quotes on, and the payment checks that would receive the funds are not real yet.
 */
export function FundFromChain({ amountUsd, disabled }: { amountUsd: number; disabled?: boolean }) {
  const [open, setOpen] = useState(false);
  const client = useMemo(() => new IntentsClient(`${API}/v1/intents`), []);
  const [origins, setOrigins] = useState<OneClickToken[] | null>(null);
  const [originId, setOriginId] = useState("");
  const [refundTo, setRefundTo] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<QuoteSummary | null>(null);

  const origin = origins?.find((t) => t.assetId === originId) ?? null;
  const chain = origin ? chainOf(origin) : null;
  const refundProblem = chain && refundTo.trim() ? addressProblem(chain, refundTo) : null;

  async function load() {
    setOpen((o) => !o);
    if (origins || busy) return;
    setBusy(true);
    setError(null);
    try {
      const list = fundingOrigins(await client.tokens());
      setOrigins(list);
      setOriginId(list.find((t) => t.blockchain === "arb" && t.symbol === "USDC")?.assetId ?? list[0]?.assetId ?? "");
    } catch (e) {
      setError(e instanceof IntentsError ? e.message : "Could not load the list of tokens.");
    } finally {
      setBusy(false);
    }
  }

  async function getQuote() {
    if (!origin || !chain) return;
    setBusy(true);
    setError(null);
    setSummary(null);
    try {
      const response = await client.quote(fundingRequest({ originAsset: origin.assetId, amountUsd, refundTo: refundTo.trim(), recipient: RECIPIENT, dry: true }));
      setSummary(summarizeQuote(response, origin));
    } catch (e) {
      setError(e instanceof IntentsError ? e.message : "Could not get a quote.");
    } finally {
      setBusy(false);
    }
  }

  const canQuote = amountUsd > 0 && !!origin && !!chain && refundTo.trim() !== "" && !refundProblem && !busy && !disabled;

  return (
    <div className="border border-line">
      <button type="button" className="flex w-full items-center justify-between gap-3 p-4 text-left text-sm" onClick={() => void load()} aria-expanded={open}>
        <span>
          <span className="text-text">Pay from another chain</span>
          <span className="mt-0.5 block text-xs text-faint">See what it costs to fund this bid from Ethereum, Base, Arbitrum or Solana. Powered by NEAR Intents.</span>
        </span>
        <ChevronDown className={cx("size-4 shrink-0 text-muted transition-transform", open && "rotate-180")} />
      </button>

      {open && (
        <div className="space-y-4 border-t border-line p-4 text-sm">
          {busy && !origins && <p className="flex items-center gap-2 text-muted"><Loader2 className="size-4 animate-spin" /> Loading tokens…</p>}
          {origins && (
            <>
              <label className="block text-xs text-muted">
                Pay with
                <select className={cx(field, "mt-1 font-sans")} value={originId} onChange={(e) => { setOriginId(e.target.value); setSummary(null); }} aria-label="Pay with">
                  {origins.map((t) => <option key={t.assetId} value={t.assetId}>{t.symbol} on {CHAIN_NAME[t.blockchain] ?? t.blockchain}</option>)}
                </select>
              </label>
              <label className="block text-xs text-muted">
                Refund address on {chain && isChain(chain) ? CHAIN_NAME[chain] : "that chain"} (if the swap cannot finish)
                <input className={cx(field, "mt-1")} value={refundTo} onChange={(e) => { setRefundTo(e.target.value); setSummary(null); }} placeholder="Your address on that chain" aria-label="Refund address on the paying chain" />
              </label>
              {refundProblem && <p className="text-xs text-danger" role="alert">Refund address: {refundProblem}.</p>}
              <Button type="button" tone="ghost" className="w-full" onClick={() => void getQuote()} disabled={!canQuote}>
                {busy ? <Loader2 className="size-4 animate-spin" /> : null} Get a price for {amountUsd > 0 ? usd(amountUsd) : "this bid"}
              </Button>
            </>
          )}
          {error && <p className="text-sm text-danger" role="alert">{error}</p>}
          {summary && (
            <dl className="grid grid-cols-2 gap-x-4 gap-y-1.5 border border-line bg-bg p-3 text-xs" data-testid="funding-quote">
              <dt className="text-faint">You pay</dt><dd className="text-right"><Mono>{summary.pay}</Mono></dd>
              <dt className="text-faint">The bid receives</dt><dd className="text-right"><Mono>{summary.receive}</Mono></dd>
              <dt className="text-faint">Cost of the swap</dt><dd className="text-right"><Mono>{summary.costUsd === null ? "—" : usd(summary.costUsd)}</Mono></dd>
              <dt className="text-faint">At least (after slippage)</dt><dd className="text-right"><Mono>{summary.minPay}</Mono></dd>
              <dt className="text-faint">Time</dt><dd className="text-right"><Mono>{summary.etaSeconds === null ? "—" : `about ${summary.etaSeconds}s`}</Mono></dd>
              <dt className="text-faint">Deposit address</dt><dd className="text-right">{summary.depositAddress ? <Mono>{summary.depositAddress}</Mono> : <span className="text-price">none: a preview, nothing to pay</span>}</dd>
            </dl>
          )}
          <p className="text-xs leading-relaxed text-faint">
            This is a price preview from NEAR Intents (mainnet). Funds would land at <Mono>{RECIPIENT}</Mono>. The payment checks that would receive them are still a development stand-in, so nothing is paid here.
          </p>
        </div>
      )}
    </div>
  );
}
