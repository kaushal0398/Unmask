"use client";

import { AlertTriangle, Check, Loader2, Lock, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { PaymentCheckPanel } from "@/components/payment-check-panel";
import { useToast } from "@/components/toast";
import { useConfirm } from "@/components/confirm";
import { Button, Card, Mono, cx } from "@/components/ui";
import { WalletButton } from "@/components/wallet-button";
import { useWallet } from "@/components/wallet";
import { getApi } from "@/lib/api";
import { ApiError } from "@/lib/api/types";
import type { Launch } from "@/lib/demo";
import { shortHash, tokens, usd } from "@/lib/format";
import { newSalt, sealBid } from "@/lib/seal";

const SEAL_STEPS = ["Locking the most you could owe in a payment check", "Fetching the enclave's public key", "Sealing your bid in this browser", "Sending the sealed bid"];

type Receipt = { commitment: string; limit: number; qty: number; locked: number; checkId: string; receiptId: string };

export function BidForm({ launch, closed = false }: { launch: Launch; closed?: boolean }) {
  const { account } = useWallet();
  const toast = useToast();
  const confirm = useConfirm();
  const [limit, setLimit] = useState("");
  const [qty, setQty] = useState("");
  const [phase, setPhase] = useState<"form" | "sealing" | "sealed" | "withdrawn">("form");
  const [stepIndex, setStepIndex] = useState(0);
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [error, setError] = useState<{ message: string; strandedCheck?: string } | null>(null);
  const [withdrawing, setWithdrawing] = useState(false);

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
    if (!ready || !account) return;
    const ok = await confirm({
      title: "Seal this bid?",
      body: (
        <>
          <p>This locks up to <Mono className="text-text">{usd(locked)}</Mono> in a payment check until the auction settles. If you win you pay the clearing price, which may be lower than your limit; everything unused comes back.</p>
          <p className="mt-3">Your bid is encrypted in this browser. Nobody can read it before the close.</p>
        </>
      ),
      confirm: `Lock ${usd(locked)} and seal`,
      tone: "seal",
    });
    if (!ok) return;

    setError(null);
    setPhase("sealing");
    setStepIndex(0);
    const api = getApi();
    let checkId: string | undefined;
    try {
      const { check, key } = await api.createPaymentCheck({ launchId: launch.id, amount: locked });
      checkId = check.id;
      setStepIndex(1);
      const enclave = await api.getEnclaveKey(launch.id);
      setStepIndex(2);
      const sealed = await sealBid({ launchId: launch.id, bidder: account, limit: l, qty: q, salt: await newSalt(), paymentCheck: { id: check.id, key } }, enclave);
      setStepIndex(3);
      const { receiptId } = await api.submitBid(sealed);
      setReceipt({ commitment: sealed.commitment, limit: l, qty: q, locked, checkId: check.id, receiptId });
      setPhase("sealed");
      toast("Your bid is sealed.", "ok");
    } catch (e) {
      const message = e instanceof ApiError || e instanceof Error ? e.message : "Something went wrong sealing your bid.";
      setError({ message, strandedCheck: checkId });
      setPhase("form");
      toast(message, "error");
    }
  }

  async function releaseStranded() {
    if (!error?.strandedCheck) return;
    try {
      await getApi().reclaimPaymentCheck(error.strandedCheck);
      setError({ message: error.message });
      toast("Your funds were released.", "ok");
    } catch (e) {
      toast(e instanceof Error ? e.message : "Could not release the funds.", "error");
    }
  }

  async function withdraw() {
    if (!account || !receipt) return;
    const ok = await confirm({
      title: "Withdraw your bid?",
      body: <p>Your bid is cancelled and the {usd(receipt.locked)} in your payment check is released to you. You can bid again until the close.</p>,
      confirm: "Withdraw bid",
      tone: "danger",
    });
    if (!ok) return;
    setWithdrawing(true);
    try {
      await getApi().withdrawBid(launch.id, account);
      setPhase("withdrawn");
      setReceipt(null);
      toast("Bid withdrawn and funds released.", "ok");
    } catch (e) {
      toast(e instanceof ApiError ? e.message : "Could not withdraw the bid.", "error");
    } finally {
      setWithdrawing(false);
    }
  }

  if (phase === "sealing") {
    return (
      <Card className="p-6" aria-busy="true">
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
          <div className="flex justify-between gap-4"><dt className="text-muted">Receipt</dt><dd><Mono>{receipt.receiptId}</Mono></dd></div>
          <div className="flex justify-between gap-4"><dt className="text-muted">Commitment</dt><dd><Mono className="text-seal">{shortHash(receipt.commitment, 10, 8)}</Mono></dd></div>
        </dl>
        <div className="mt-5"><PaymentCheckPanel checkId={receipt.checkId} /></div>
        <p className="mt-5 border border-line bg-black/40 p-4 text-xs leading-relaxed text-muted">
          The commitment is a hash of your bid and a secret salt. After the close it lets you prove the bid was yours. Withdrawing before the close cancels the bid and releases your funds.
        </p>
        <Button tone="ghost" className="mt-5 w-full" onClick={() => void withdraw()} disabled={withdrawing || closed}>
          {withdrawing && <Loader2 className="size-4 animate-spin" />} Withdraw my bid
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
      {phase === "withdrawn" && <p className="mt-3 border border-line-strong p-3 text-sm text-muted" role="status">Bid withdrawn and your funds released. You can bid again before the close.</p>}
      {closed && <p className="mt-3 border border-line-strong p-3 text-sm text-muted" role="status">Bidding has closed on this launch.</p>}
      {error && (
        <div className="mt-3 border border-danger/50 bg-danger/5 p-3 text-sm" role="alert">
          <p className="flex items-start gap-2 text-danger"><AlertTriangle className="mt-0.5 size-4 shrink-0" /> {error.message}</p>
          {error.strandedCheck && (
            <p className="mt-2 text-xs text-muted">Your funds were locked before this failed. <button className="text-text underline underline-offset-4" onClick={() => void releaseStranded()}>Release them</button>, or try again and they will be used.</p>
          )}
        </div>
      )}
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
            <input inputMode="decimal" value={limit} onChange={(e) => setLimit(e.target.value)} placeholder={String(launch.reserve * 3)} disabled={closed} className="w-full bg-transparent px-2 py-3 font-mono text-lg outline-none placeholder:text-faint" aria-label="Limit price per token in dollars" />
          </div>
          <span className="mt-1.5 block text-xs text-faint">Reserve price {usd(launch.reserve)}. You will not pay more than this, and you may pay less.</span>
        </label>
        <label className="block">
          <span className="text-sm text-muted">How many tokens you want</span>
          <div className="mt-2 flex items-center rounded-none border border-line-strong bg-black px-4 focus-within:bg-white/[0.03]">
            <input inputMode="numeric" value={qty} onChange={(e) => setQty(e.target.value)} placeholder={String(Math.floor(cap / 10))} disabled={closed} className="w-full bg-transparent py-3 font-mono text-lg outline-none placeholder:text-faint" aria-label="Quantity of tokens" />
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
          <Button type="submit" tone="seal" className="w-full py-3.5 text-base" disabled={!ready || closed}>
            <Lock className="size-4" /> Seal my bid
          </Button>
        ) : (
          <div className="flex justify-center"><WalletButton /></div>
        )}
        <p className="flex items-start gap-2 text-xs leading-relaxed text-faint">
          <ShieldCheck className="mt-0.5 size-3.5 shrink-0" />
          Demo: the bid is really sealed in your browser, but it goes to a stand-in for the enclave and no funds move.
        </p>
      </form>
    </Card>
  );
}
