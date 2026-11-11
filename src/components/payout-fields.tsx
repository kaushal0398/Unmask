"use client";

import { addressProblem, CHAINS, isChain, type ChainId, type Destination } from "@/lib/intents/addresses";
import { cx } from "@/components/ui";

export type PayoutDraft = { custom: boolean; refundChain: ChainId; refundAddress: string; tokensAddress: string };
export const emptyPayout: PayoutDraft = { custom: false, refundChain: "near", refundAddress: "", tokensAddress: "" };

/** Problems with what the bidder typed. Blank addresses are fine: they mean "my own NEAR account". */
export function payoutProblems(d: PayoutDraft): string[] {
  if (!d.custom) return [];
  const out: string[] = [];
  if (d.refundAddress.trim()) { const p = addressProblem(d.refundChain, d.refundAddress); if (p) out.push(`Refund address: ${p}.`); }
  if (d.tokensAddress.trim()) { const p = addressProblem("near", d.tokensAddress); if (p) out.push(`Token address: ${p}.`); }
  return out;
}

/** What goes inside the sealed bid, or undefined when the defaults apply. */
export function toPayout(d: PayoutDraft): { refundTo?: Destination; tokensTo?: Destination } | undefined {
  if (!d.custom) return undefined;
  const refundTo = d.refundAddress.trim() ? { chain: d.refundChain, address: d.refundAddress.trim() } : undefined;
  const tokensTo = d.tokensAddress.trim() ? { chain: "near" as const, address: d.tokensAddress.trim() } : undefined;
  return refundTo || tokensTo ? { ...(refundTo ? { refundTo } : {}), ...(tokensTo ? { tokensTo } : {}) } : undefined;
}

const field = "w-full border border-line-strong bg-bg px-3 py-2 font-mono text-sm outline-none placeholder:text-faint focus:bg-white/[0.03] disabled:opacity-50";

/**
 * Where refunds and tokens go. Refunds are USDC, so they can go to any supported chain through NEAR Intents.
 * Tokens are a new NEP-141 that NEAR Intents does not carry, so they can only go to a NEAR account.
 * Both destinations are sealed inside the bid; the public result shows only the plan.
 */
export function PayoutFields({ value, onChange, account, disabled }: { value: PayoutDraft; onChange: (v: PayoutDraft) => void; account: string | null; disabled?: boolean }) {
  const problems = payoutProblems(value);
  const example = CHAINS.find((c) => c.id === value.refundChain)?.example ?? "";
  return (
    <div className="border border-line p-4">
      <label className="flex cursor-pointer items-start gap-3 text-sm">
        <input type="checkbox" className="mt-1 accent-[#e501a5]" checked={value.custom} disabled={disabled} onChange={(e) => onChange({ ...value, custom: e.target.checked })} />
        <span>
          <span className="text-text">Send my refund and tokens somewhere else</span>
          <span className="mt-0.5 block text-xs text-faint">Default: your own NEAR account{account ? ` (${account})` : ""}. Sealed inside your bid, like the amounts.</span>
        </span>
      </label>

      {value.custom && (
        <div className="mt-4 space-y-4">
          <div>
            <span className="text-xs uppercase tracking-wider text-faint">Refund (USDC) goes to</span>
            <div className="mt-2 grid gap-2 sm:grid-cols-[9rem_1fr]">
              <select aria-label="Refund chain" className={cx(field, "font-sans")} value={value.refundChain} disabled={disabled} onChange={(e) => isChain(e.target.value) && onChange({ ...value, refundChain: e.target.value })}>
                {CHAINS.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              <input aria-label="Refund address" className={field} value={value.refundAddress} disabled={disabled} placeholder={example} onChange={(e) => onChange({ ...value, refundAddress: e.target.value })} />
            </div>
            {value.refundChain !== "near" && <p className="mt-1.5 text-xs text-faint">Sent through NEAR Intents, which charges its own fee. Funds are only moved once real payment checks exist.</p>}
          </div>
          <div>
            <span className="text-xs uppercase tracking-wider text-faint">Tokens go to (a NEAR account)</span>
            <input aria-label="Token address" className={cx(field, "mt-2")} value={value.tokensAddress} disabled={disabled} placeholder={account ?? "you.near"} onChange={(e) => onChange({ ...value, tokensAddress: e.target.value })} />
            <p className="mt-1.5 text-xs text-faint">A new launch token is not carried by NEAR Intents, so it can only go to a NEAR account.</p>
          </div>
          {problems.length > 0 && <ul className="space-y-1 text-sm text-danger" role="alert">{problems.map((p) => <li key={p}>{p}</li>)}</ul>}
        </div>
      )}
    </div>
  );
}
