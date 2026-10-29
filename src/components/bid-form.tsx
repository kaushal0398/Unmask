"use client";

import { Check, Loader2, Lock, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { Button, Card, Mono, cx } from "@/components/ui";
import { useWallet } from "@/components/wallet";
import type { Launch } from "@/lib/demo";
import { shortHash, tokens, usd } from "@/lib/format";

const SEAL_STEPS = ["Encrypting your bid for the enclave", "Locking the most you could owe in a payment check", "Sealing and sending"];

async function sha256Hex(text: string) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, "0")).join("");
}

type Receipt = { commitment: string; limit: number; qty: number; locked: number };

export function BidForm({ launch }: { launch: Launch }) {
  const { account, connect } = useWallet();
  const [limit, setLimit] = useState("");
  const [qty, setQty] = useState("");
  const [phase, setPhase] = useState<"form" | "sealing" | "sealed" | "withdrawn">("form");
  const [stepIndex, setStepIndex] = useState(0);
  const [receipt, setReceipt] = useState<Receipt | null>(null);

  const cap = launch.cap ? Math.floor(launch.supply * launch.cap) : launch.supply;
  const l = Number(limit);
  const q = Number(qty);
  const problems: string[] = [];
  if (limit !== "" && !(l >= launch.reserve)) problems.push(`The limit price must be at least the reserve, ${usd(launch.reserve)}.`);
  if (qty !== "" && !(Number.isInteger(q) && q > 0)) problems.push("Quantity must be a whole number of tokens.");
  if (qty !== "" && q > cap) problems.push(`The most one account may bid for is ${tokens(cap)} tokens.`);
  const ready = limit !== "" && qty !== "" && problems.length === 0;
  const locked = ready ? l * q : 0;

  async function submit() {
    if (!ready) return;
    setPhase("sealing");
    setStepIndex(0);
    const salt = Array.from(crypto.getRandomValues(new Uint8Array(16)), (b) => b.toString(16).padStart(2, "0")).join("");
    const commitment = await sha256Hex(JSON.stringify({ launch: launch.id, bidder: account, limit: l, qty: q, salt }));
    for (let i = 1; i < SEAL_STEPS.length; i++) {
      await new Promise((r) => setTimeout(r, 750));
      setStepIndex(i);
    }
    await new Promise((r) => setTimeout(r, 750));
    setReceipt({ commitment, limit: l, qty: q, locked: l * q });
    setPhase("sealed");
  }

  if (phase === "sealing") {
    return (
      <Card className="p-6">
        <h3 className="text-lg font-semibold">Sealing your bid</h3>
        <ol className="mt-5 space-y-3">
          {SEAL_STEPS.map((s, i) => (
            <li key={s} className={cx("flex items-center gap-3 text-sm transition-colors", i <= stepIndex ? "text-text" : "text-faint")}>
              {i < stepIndex ? <Check className="size-4 text-verified" /> : i === stepIndex ? <Loader2 className="size-4 animate-spin text-seal" /> : <span className="size-4 rounded-none border border-line-strong" />}
              {s}
            </li>
          ))}
        </ol>
      </Card>
    );
  }

  if (phase === "sealed" && receipt) {
    return (
      <Card className="border-seal/30 p-6">
        <div className="flex items-center gap-3">
          <span className="grid size-10 place-items-center rounded-none bg-seal text-black"><Lock className="size-5" /></span>
          <div>
            <h3 className="text-lg font-semibold">Your bid is sealed</h3>
            <p className="text-sm text-muted">Nobody can read it. Not us, not the creator, not another bidder.</p>
          </div>
        </div>
        <dl className="mt-6 space-y-3 text-sm">
          <div className="flex justify-between gap-4"><dt className="text-muted">Locked in your payment check</dt><dd><Mono>{usd(receipt.locked)}</Mono></dd></div>
          <div className="flex justify-between gap-4"><dt className="text-muted">Commitment</dt><dd><Mono className="text-seal">{shortHash(receipt.commitment, 10, 8)}</Mono></dd></div>
        </dl>
        <p className="mt-5 rounded-none border border-line bg-black/40 p-4 text-xs leading-relaxed text-muted">
          The commitment is a hash of your bid and a secret salt that only you hold. After the close you can prove the bid was yours. If you win you pay the single clearing price, which can be lower than your limit, and the rest comes back to you. Withdrawing your payment check before the close cancels the bid.
        </p>
        <Button tone="ghost" className="mt-5 w-full" onClick={() => { setPhase("withdrawn"); setReceipt(null); }}>
          Withdraw my bid
        </Button>
      </Card>
    );
  }

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold tracking-tight">Place a sealed bid</h3>
        <span className="flex items-center gap-1.5 text-xs text-seal"><Lock className="size-3.5" /> private</span>
      </div>
      {phase === "withdrawn" && <p className="mt-3 rounded-none border border-line-strong p-3 text-sm text-muted">Bid withdrawn and your payment check released. You can bid again before the close.</p>}
      <form
        className="mt-5 space-y-5"
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        <label className="block">
          <span className="text-sm text-muted">Most you would pay per token</span>
          <div className="mt-2 flex items-center rounded-none border border-line-strong bg-black px-4 focus-within:bg-white/[0.03]">
            <span className="text-muted">$</span>
            <input inputMode="decimal" value={limit} onChange={(e) => setLimit(e.target.value)} placeholder={String(launch.reserve * 3)} className="w-full bg-transparent px-2 py-3 font-mono text-lg outline-none placeholder:text-faint" aria-label="Limit price per token in dollars" />
          </div>
          <span className="mt-1.5 block text-xs text-faint">Reserve price {usd(launch.reserve)}. You will not pay more than this, and you may pay less.</span>
        </label>
        <label className="block">
          <span className="text-sm text-muted">How many tokens you want</span>
          <div className="mt-2 flex items-center rounded-none border border-line-strong bg-black px-4 focus-within:bg-white/[0.03]">
            <input inputMode="numeric" value={qty} onChange={(e) => setQty(e.target.value)} placeholder={String(Math.floor(cap / 10))} className="w-full bg-transparent py-3 font-mono text-lg outline-none placeholder:text-faint" aria-label="Quantity of tokens" />
            <span className="font-mono text-sm text-muted">{launch.symbol}</span>
          </div>
          <span className="mt-1.5 block text-xs text-faint">{launch.cap ? `Up to ${tokens(cap)} per account.` : "No cap per account."}</span>
        </label>

        {problems.length > 0 && (
          <ul className="space-y-1 text-sm text-danger" role="alert">
            {problems.map((p) => <li key={p}>{p}</li>)}
          </ul>
        )}

        <div className="rounded-none border border-line bg-black/40 p-4 text-sm">
          <div className="flex justify-between"><span className="text-muted">You lock, at most</span><Mono>{ready ? usd(locked) : "—"}</Mono></div>
          <div className="mt-2 flex justify-between"><span className="text-muted">You pay if you win</span><span className="text-text">the clearing price × what you get</span></div>
          <div className="mt-2 flex justify-between"><span className="text-muted">Everything unused</span><span className="text-text">comes back to you</span></div>
        </div>

        {account ? (
          <Button type="submit" tone="seal" className="w-full py-3.5 text-base" disabled={!ready}>
            <Lock className="size-4" /> Seal my bid
          </Button>
        ) : (
          <Button type="button" tone="primary" className="w-full py-3.5 text-base" onClick={connect}>
            Connect wallet to bid
          </Button>
        )}
        <p className="flex items-start gap-2 text-xs leading-relaxed text-faint">
          <ShieldCheck className="mt-0.5 size-3.5 shrink-0" />
          Demo: nothing is sent and no funds move. In the real flow your bid is encrypted to the enclave and your funds sit in a payment check you control.
        </p>
      </form>
    </Card>
  );
}
