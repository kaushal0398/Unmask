
"use client";

import {
  AlertTriangle,
  Check,
  Loader2,
  Lock,
  ShieldCheck,
} from "lucide-react";
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

const SEAL_STEPS = [
  "Creating a development payment check",
  "Fetching the enclave's public key",
  "Sealing your bid in this browser",
  "Sending the sealed bid to the backend",
];

type BidRevealFile = {
  format: "sealed-launchpad-bid-reveal";
  version: 1;
  receiptId: string;
  launchId: string;
  bidder: string;
  limit: number;
  qty: number;
  paymentCheckId: string;
  salt: string;
  commitment: string;
};

type Receipt = {
  commitment: string;
  limit: number;
  qty: number;
  locked: number;
  checkId: string;
  receiptId: string;
  reveal: BidRevealFile;
};

function downloadRevealFile(reveal: BidRevealFile) {
  const blob = new Blob([JSON.stringify(reveal, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = `bid-reveal-${reveal.receiptId}.json`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export function BidForm({
  launch,
  closed = false,
}: {
  launch: Launch;
  closed?: boolean;
}) {
  const { account, auth, mode } = useWallet();
  const toast = useToast();
  const confirm = useConfirm();

  const [limit, setLimit] = useState(() =>
    String(launch.reserve * 3)
  );

  const [qty, setQty] = useState(() =>
    String(
      Math.floor(
        (launch.cap
          ? launch.supply * launch.cap
          : launch.supply) / 10
      )
    )
  );

  const [phase, setPhase] = useState<
    "form" | "sealing" | "sealed" | "withdrawn"
  >("form");

  const [stepIndex, setStepIndex] = useState(0);
  const [receipt, setReceipt] = useState<Receipt | null>(null);

  const [error, setError] = useState<{
    message: string;
    strandedCheck?: string;
    duplicateBid?: boolean;
  } | null>(null);

  const [withdrawing, setWithdrawing] = useState(false);
  const [reclaiming, setReclaiming] = useState(false);

  const biddingClosed = closed;

  const authenticated = Boolean(
    account && auth?.token && mode === "real"
  );

  const cap = launch.cap
    ? Math.floor(launch.supply * launch.cap)
    : launch.supply;

  const l = Number(limit);
  const q = Number(qty);

  const problems: string[] = [];

  if (limit !== "" && !(l >= launch.reserve)) {
    problems.push(
      `The limit price must be at least the reserve, ${usd(launch.reserve)}.`
    );
  }

  if (qty !== "" && !(Number.isInteger(q) && q > 0)) {
    problems.push("Quantity must be a whole number of tokens.");
  }

  if (qty !== "" && q > cap) {
    problems.push(
      `The most one account may bid for is ${tokens(cap)} tokens.`
    );
  }

  const ready =
    limit !== "" && qty !== "" && problems.length === 0;

  const locked = ready ? l * q : 0;

  // Once the backend confirms a duplicate bid, prevent another attempt.
  const duplicateBid = error?.duplicateBid === true;

  async function submit() {
    if (biddingClosed) {
      toast("Bidding has closed for this launch.", "error");
      return;
    }

    if (duplicateBid) {
      toast(
        "Your wallet has already submitted a bid for this launch.",
        "error"
      );
      return;
    }

    if (!ready || !account) return;

    if (!auth?.token || mode !== "real") {
      toast(
        "Connect and authenticate your real NEAR wallet before bidding.",
        "error"
      );
      return;
    }

    const ok = await confirm({
      title: "Seal this bid?",
      body: (
        <>
          <p>
            Your bid will be prepared using the development payment-check
            provider. The current implementation does not transfer or lock
            real funds.
          </p>

          <p className="mt-3">
            Your bid data is sealed in this browser using the currently
            configured development enclave key. A production TEE integration
            is not connected yet.
          </p>

          <p className="mt-3">
            Maximum bid amount:{" "}
            <Mono className="text-text">{usd(locked)}</Mono>
          </p>
        </>
      ),
      confirm: "Continue and seal bid",
      tone: "seal",
    });

    if (!ok) return;

    setError(null);
    setPhase("sealing");
    setStepIndex(0);

    const api = getApi(auth.token);
    let checkId: string | undefined;

    try {
      // Step 1: Create authenticated payment check.
      const { check, key } = await api.createPaymentCheck({
        launchId: launch.id,
        bidder: account,
        amount: locked,
      });

      checkId = check.id;
      setStepIndex(1);

      // Step 2: Fetch the configured enclave public key.
      const enclave = await api.getEnclaveKey(launch.id);

      setStepIndex(2);

      // Step 3: Seal the bid locally.
      // Keep the salt so the bidder can independently recompute the
      // commitment later. It is never sent to the backend as plaintext.
      const salt = await newSalt();
      const plaintextBid = {
        launchId: launch.id,
        bidder: account,
        limit: l,
        qty: q,
        salt,
        paymentCheck: {
          id: check.id,
          key,
        },
      };

      const sealed = await sealBid(plaintextBid, enclave);

      setStepIndex(3);

      // Step 4: Submit the sealed bid using the authenticated API.
      const { receiptId } = await api.submitBid(sealed);

      const reveal: BidRevealFile = {
        format: "sealed-launchpad-bid-reveal",
        version: 1,
        receiptId,
        launchId: launch.id,
        bidder: account,
        limit: l,
        qty: q,
        paymentCheckId: check.id,
        salt,
        commitment: sealed.commitment,
      };

      setReceipt({
        commitment: sealed.commitment,
        limit: l,
        qty: q,
        locked,
        checkId: check.id,
        receiptId,
        reveal,
      });

      // Download immediately so navigating away cannot silently discard
      // the only copy of the bidder's private reveal material.
      downloadRevealFile(reveal);

      setPhase("sealed");
      toast("Your bid was submitted.", "ok");
    } catch (e) {
      const isDuplicate =
        e instanceof ApiError && e.code === "duplicate_bid";

      const message = isDuplicate
        ? "Your wallet has already submitted a bid for this launch. Only one bid per wallet is currently allowed."
        : e instanceof Error
          ? e.message
          : "Something went wrong sealing your bid.";

      setError({
        message,
        strandedCheck: checkId,
        duplicateBid: isDuplicate,
      });

      setPhase("form");

      toast(message, "error");
    }
  }

  async function releaseStranded() {
    if (!error?.strandedCheck || !auth?.token) {
      toast("An authenticated wallet session is required.", "error");
      return;
    }

    setReclaiming(true);

    try {
      await getApi(auth.token).reclaimPaymentCheck(
        error.strandedCheck
      );

      setError({
        message: error.message,
        duplicateBid: error.duplicateBid,
      });

      toast(
        "Payment check reclaimed. No real funds were transferred.",
        "ok"
      );
    } catch (e) {
      toast(
        e instanceof Error
          ? e.message
          : "Could not reclaim the payment check.",
        "error"
      );
    } finally {
      setReclaiming(false);
    }
  }

  async function withdraw() {
    if (!account || !receipt || !auth?.token) return;

    const ok = await confirm({
      title: "Withdraw your bid?",
      body: (
        <p>
          This will attempt to cancel your bid using the current
          development withdrawal implementation.
        </p>
      ),
      confirm: "Withdraw bid",
      tone: "danger",
    });

    if (!ok) return;

    setWithdrawing(true);

    try {
      await getApi(auth.token).withdrawBid(launch.id, account);

      setPhase("withdrawn");
      setReceipt(null);

      toast(
        "Bid withdrawal completed in the current implementation.",
        "ok"
      );
    } catch (e) {
      toast(
        e instanceof ApiError
          ? e.message
          : "Could not withdraw the bid.",
        "error"
      );
    } finally {
      setWithdrawing(false);
    }
  }

  if (phase === "sealing") {
    return (
      <Card className="p-6" aria-busy="true">
        <h3 className="text-lg font-semibold">
          Sealing your bid
        </h3>

        <ol className="mt-5 space-y-3">
          {SEAL_STEPS.map((step, i) => (
            <li
              key={step}
              className={cx(
                "flex items-center gap-3 text-sm transition-colors",
                i <= stepIndex ? "text-text" : "text-faint"
              )}
            >
              {i < stepIndex ? (
                <Check className="size-4 text-verified" />
              ) : i === stepIndex ? (
                <Loader2 className="size-4 animate-spin text-seal" />
              ) : (
                <span className="size-4 rounded-none border border-line-strong" />
              )}

              {step}
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
          <span className="grid size-10 place-items-center rounded-none bg-seal text-black">
            <Lock className="size-5" />
          </span>

          <div>
            <h3 className="text-lg font-semibold">
              Your bid was submitted
            </h3>

            <p className="text-sm text-muted">
              Your bid commitment and backend receipt have been recorded.
            </p>
          </div>
        </div>

        <dl className="mt-6 space-y-3 text-sm">
          <div className="flex justify-between gap-4">
            <dt className="text-muted">Receipt</dt>
            <dd>
              <Mono>{receipt.receiptId}</Mono>
            </dd>
          </div>

          <div className="flex justify-between gap-4">
            <dt className="text-muted">Commitment</dt>
            <dd>
              <Mono className="text-seal">
                {shortHash(receipt.commitment, 10, 8)}
              </Mono>
            </dd>
          </div>
        </dl>

        <div className="mt-5">
          <PaymentCheckPanel checkId={receipt.checkId} />
        </div>

        <div className="mt-5 border border-seal/30 bg-seal/5 p-4">
          <p className="text-sm font-medium text-text">
            Private bid reveal file
          </p>
          <p className="mt-1 text-xs leading-relaxed text-muted">
            A JSON backup containing your bid values and salt was downloaded.
            Keep it private. Anyone with this file can learn your bid. Do not
            share it until the auction has closed and disclosure is safe.
          </p>
          <Button
            tone="seal"
            className="mt-3 w-full"
            onClick={() => downloadRevealFile(receipt.reveal)}
          >
            Download reveal file again
          </Button>
        </div>

        <p className="mt-5 border border-line bg-bg/40 p-4 text-xs leading-relaxed text-muted">
          Development mode: the payment provider and enclave are
          currently mocks. No real funds are locked, and production
          settlement and TEE privacy are not yet implemented.
        </p>

        <Button
          tone="ghost"
          className="mt-5 w-full"
          onClick={() => void withdraw()}
          disabled={withdrawing || biddingClosed}
        >
          {withdrawing && (
            <Loader2 className="size-4 animate-spin" />
          )}
          Withdraw my bid
        </Button>
      </Card>
    );
  }

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold tracking-tight">
          Place a sealed bid
        </h3>

        <span className="flex items-center gap-1.5 text-xs text-seal">
          <Lock className="size-3.5" />
          private
        </span>
      </div>

      {phase === "withdrawn" && (
        <p
          className="mt-3 border border-line-strong p-3 text-sm text-muted"
          role="status"
        >
          Bid withdrawal completed. You can submit another bid before
          the auction closes.
        </p>
      )}

      {biddingClosed && (
        <p
          className="mt-3 border border-line-strong p-3 text-sm text-muted"
          role="status"
        >
          Bidding has closed on this launch.
        </p>
      )}

      {!authenticated && !biddingClosed && (
        <p className="mt-3 border border-line-strong p-3 text-sm text-muted">
          Authenticate your real NEAR wallet to submit a backend bid.
          Demo wallet bidding is not supported.
        </p>
      )}

      {error && (
        <div
          className="mt-3 border border-danger/50 bg-danger/5 p-3 text-sm"
          role="alert"
        >
          <p className="flex items-start gap-2 text-danger">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" />
            {error.message}
          </p>

          {duplicateBid && (
            <p className="mt-2 text-xs text-muted">
              Your existing bid remains recorded. Visit My Bids to view
              its receipt. You cannot submit another bid from this wallet
              for this launch.
            </p>
          )}

          {error.strandedCheck && (
            <p className="mt-2 text-xs text-muted">
              A development payment check was created before the
              bid failed. You can attempt to reclaim it after it
              expires.{" "}
              <button
                className="text-text underline underline-offset-4 disabled:opacity-50"
                onClick={() => void releaseStranded()}
                disabled={reclaiming || !auth?.token}
              >
                {reclaiming ? "Reclaiming..." : "Reclaim payment check"}
              </button>
            </p>
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
          <span className="text-sm text-muted">
            Most you would pay per token
          </span>

          <div className="mt-2 flex items-center rounded-none border border-line-strong bg-bg px-4 focus-within:bg-white/[0.03]">
            <span className="text-muted">$</span>

            <input
              inputMode="decimal"
              value={limit}
              onChange={(e) => setLimit(e.target.value)}
              placeholder={String(launch.reserve * 3)}
              disabled={biddingClosed || duplicateBid}
              className="w-full bg-transparent px-2 py-3 font-mono text-lg outline-none placeholder:text-faint"
              aria-label="Limit price per token in dollars"
            />
          </div>

          <span className="mt-1.5 block text-xs text-faint">
            Reserve price {usd(launch.reserve)}.
          </span>
        </label>

        <label className="block">
          <span className="text-sm text-muted">
            How many tokens you want
          </span>

          <div className="mt-2 flex items-center rounded-none border border-line-strong bg-bg px-4 focus-within:bg-white/[0.03]">
            <input
              inputMode="numeric"
              value={qty}
              onChange={(e) => setQty(e.target.value)}
              placeholder={String(Math.floor(cap / 10))}
              disabled={biddingClosed || duplicateBid}
              className="w-full bg-transparent py-3 font-mono text-lg outline-none placeholder:text-faint"
              aria-label="Quantity of tokens"
            />

            <span className="font-mono text-sm text-muted">
              {launch.symbol}
            </span>
          </div>

          <span className="mt-1.5 block text-xs text-faint">
            {launch.cap
              ? `Up to ${tokens(cap)} per account.`
              : "No cap per account."}
          </span>
        </label>

        {problems.length > 0 && !duplicateBid && (
          <ul
            className="space-y-1 text-sm text-danger"
            role="alert"
          >
            {problems.map((problem) => (
              <li key={problem}>{problem}</li>
            ))}
          </ul>
        )}

        <div className="rounded-none border border-line bg-bg/40 p-4 text-sm">
          <div className="flex justify-between">
            <span className="text-muted">
              Maximum bid amount
            </span>
            <Mono>{ready ? usd(locked) : "—"}</Mono>
          </div>

          <div className="mt-2 flex justify-between">
            <span className="text-muted">Payment provider</span>
            <span className="text-text">Development mock</span>
          </div>

          <div className="mt-2 flex justify-between">
            <span className="text-muted">Real funds transferred</span>
            <span className="text-text">No</span>
          </div>
        </div>

        {account ? (
          <Button
            type="submit"
            tone="seal"
            className="w-full py-3.5 text-base"
            disabled={
              !ready ||
              biddingClosed ||
              !authenticated ||
              duplicateBid
            }
          >
            <Lock className="size-4" />
            {duplicateBid ? "Bid already submitted" : "Seal my bid"}
          </Button>
        ) : (
          <div className="flex justify-center">
            <WalletButton />
          </div>
        )}

        <p className="flex items-start gap-2 text-xs leading-relaxed text-faint">
          <ShieldCheck className="mt-0.5 size-3.5 shrink-0" />
          Development implementation: bid sealing runs in your
          browser, but the enclave and payment provider are mocks.
          No real funds move.
        </p>
      </form>
    </Card>
  );
}
