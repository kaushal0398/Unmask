"use client";

import { Bot, Check, Loader2 } from "lucide-react";
import { useState } from "react";
import { useToast } from "@/components/toast";
import { Button, Mono } from "@/components/ui";
import { useWallet } from "@/components/wallet";
import { agentViolations, newRules, proposeBid, rulesHash, VIOLATION_TEXT, type AgentClaim, type AgentRules } from "@/lib/agent";
import { shortHash, tokens, usd } from "@/lib/format";

export type AgentApplied = { claim: AgentClaim; limit: number; qty: number };

type Launch = { id: string; symbol: string; reserve: number; supply: number; cap?: number | null };

const field = "w-full border border-line-strong bg-bg px-3 py-2 font-mono text-sm outline-none focus:bg-white/[0.03] disabled:opacity-50";

/**
 * Let an agent place the bid for you, inside limits you set and sign.
 * The agent bids its maximum price (in a uniform-price auction you pay the clearing price, never your own limit),
 * for as many tokens as the limits allow. The same limits are checked again when the launch settles, so an agent
 * that ignores them gets its bid skipped.
 */
export function AgentMode({ launch, account, applied, onApply, onClear, disabled }: { launch: Launch; account: string; applied: AgentApplied | null; onApply: (a: AgentApplied) => void; onClear: () => void; disabled?: boolean }) {
  const { signRules, mode } = useWallet();
  const toast = useToast();
  const [maxPrice, setMaxPrice] = useState(String(launch.reserve * 3));
  const [maxQty, setMaxQty] = useState(String(Math.floor((launch.cap ? launch.supply * launch.cap : launch.supply) / 10)));
  const [maxSpend, setMaxSpend] = useState("");
  const [minutes, setMinutes] = useState("60");
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  const price = Number(maxPrice), qty = Number(maxQty);
  const spend = maxSpend === "" ? price * qty : Number(maxSpend);

  async function setRules() {
    setProblem(null);
    if (!(price > 0) || !(qty >= 1) || !Number.isInteger(qty) || !(spend > 0) || !(Number(minutes) > 0)) return setProblem("Enter a positive price, a whole number of tokens, a spend limit and a time.");
    setBusy(true);
    try {
      const now = new Date();
      const rules: AgentRules = newRules({ owner: account, launchId: launch.id, maxLimitPrice: price, maxQty: qty, maxSpend: spend, minutes: Number(minutes), now, nonce: crypto.randomUUID() });
      const proposal = proposeBid(rules, { reserve: launch.reserve, supply: launch.supply, capBps: launch.cap ? Math.round(launch.cap * 10_000) : null, at: now });
      if (!proposal.ok) return setProblem(`The agent would not bid: ${proposal.reason}.`);
      const own = agentViolations(rules, { launchId: launch.id, bidder: account, limit: proposal.limit, qty: proposal.qty }, now);
      if (own.length) return setProblem(`The agent's own bid breaks the rules: ${own.map((v) => VIOLATION_TEXT[v]).join("; ")}.`);

      let signature: { signature: string; publicKey: string } | null = null;
      try {
        signature = await signRules(rules);
      } catch (error) {
        return setProblem(error instanceof Error ? error.message : "The wallet could not sign the rules.");
      }
      onApply({ claim: { rules, rulesHash: await rulesHash(rules), ...(signature ?? {}) }, limit: proposal.limit, qty: proposal.qty });
      toast(signature ? "Rules signed with your wallet." : "Rules set. The demo wallet cannot sign, so they are not signed.", signature ? "ok" : "info");
    } finally {
      setBusy(false);
    }
  }

  if (applied) {
    const r = applied.claim.rules;
    const signed = Boolean(applied.claim.signature);
    return (
      <div className="border border-near/50 p-4 text-sm" data-testid="agent-summary">
        <div className="flex items-center justify-between gap-3">
          <span className="flex items-center gap-2 font-medium text-near"><Bot className="size-4" /> Agent bidding for you</span>
          <button type="button" className="text-xs text-muted underline underline-offset-4 hover:text-text disabled:opacity-50" onClick={onClear} disabled={disabled}>change rules</button>
        </div>
        <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
          <dt className="text-faint">Most per token</dt><dd className="text-right"><Mono>{usd(r.maxLimitPrice)}</Mono></dd>
          <dt className="text-faint">Most tokens</dt><dd className="text-right"><Mono>{tokens(r.maxQty)}</Mono></dd>
          <dt className="text-faint">Most it can lock</dt><dd className="text-right"><Mono>{usd(r.maxSpend)}</Mono></dd>
          <dt className="text-faint">Rules expire</dt><dd className="text-right"><Mono>{new Date(r.expiresAt).toLocaleTimeString()}</Mono></dd>
          <dt className="text-faint">Rules hash</dt><dd className="text-right"><Mono>{shortHash(applied.claim.rulesHash)}</Mono></dd>
          <dt className="text-faint">Signature</dt>
          <dd className={signed ? "text-right text-verified" : "text-right text-price"}>{signed ? "signed by your wallet" : "not signed (demo wallet)"}</dd>
        </dl>
        <p className="mt-3 flex items-start gap-2 text-xs text-muted"><Check className="mt-0.5 size-3.5 shrink-0 text-verified" /> The agent will bid {usd(applied.limit)} for {tokens(applied.qty)} {launch.symbol}. You still pay only the clearing price. Breaking any rule gets the bid skipped when the launch settles.</p>
      </div>
    );
  }

  return (
    <div className="border border-line p-4 text-sm">
      <p className="flex items-center gap-2 font-medium text-text"><Bot className="size-4 text-near" /> Let an agent bid for me</p>
      <p className="mt-1 text-xs text-faint">Set limits and sign them. The agent can only bid inside them, and the check runs again at settlement.</p>
      <div className="mt-4 grid grid-cols-2 gap-3">
        <label className="text-xs text-muted">Most per token ($)<input className={field} inputMode="decimal" value={maxPrice} onChange={(e) => setMaxPrice(e.target.value)} disabled={disabled} aria-label="Agent maximum price" /></label>
        <label className="text-xs text-muted">Most tokens<input className={field} inputMode="numeric" value={maxQty} onChange={(e) => setMaxQty(e.target.value)} disabled={disabled} aria-label="Agent maximum quantity" /></label>
        <label className="text-xs text-muted">Most it can lock ($)<input className={field} inputMode="decimal" value={maxSpend} placeholder={price > 0 && qty > 0 ? String(price * qty) : ""} onChange={(e) => setMaxSpend(e.target.value)} disabled={disabled} aria-label="Agent maximum spend" /></label>
        <label className="text-xs text-muted">Rules last (minutes)<input className={field} inputMode="numeric" value={minutes} onChange={(e) => setMinutes(e.target.value)} disabled={disabled} aria-label="Rules duration in minutes" /></label>
      </div>
      {problem && <p className="mt-3 text-sm text-danger" role="alert">{problem}</p>}
      <Button type="button" tone="ghost" className="mt-4 w-full" onClick={() => void setRules()} disabled={busy || disabled}>
        {busy ? <Loader2 className="size-4 animate-spin" /> : <Bot className="size-4" />}
        {mode === "real" ? "Sign the rules with my wallet" : "Set the rules (demo wallet cannot sign)"}
      </Button>
    </div>
  );
}
