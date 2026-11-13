
"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import {
  ArrowLeft,
  ExternalLink,
  Loader2,
  Lock,
  ShieldCheck,
} from "lucide-react";

import { useWallet } from "@/components/wallet";
import { getApi } from "@/lib/api";
import type { MyBid } from "@/lib/api/types";

function statusStyle(state: string) {
  switch (state) {
    case "locked":
      return "border-seal/40 text-seal-fg";
    case "claimed":
      return "border-verified/40 text-verified";
    case "reclaimed":
      return "border-line-strong text-muted";
    case "expired":
    case "failed":
      return "border-danger/40 text-danger";
    default:
      return "border-line-strong text-muted";
  }
}

export function BidReceiptView() {
  const params = useParams<{ id: string }>();
  const bidId = params.id;

  const { account, auth, mode } = useWallet();

  const sessionToken =
    account && auth?.token && mode === "real"
      ? auth.token
      : undefined;

  const [bid, setBid] = useState<MyBid | null>(null);
  const [reveal, setReveal] = useState<string | null>(null);

  useEffect(() => {
    try {
      setReveal(sessionStorage.getItem(`bid-reveal:${bidId}`));
    } catch {
      setReveal(null);
    }
  }, [bidId]);

  function downloadReveal() {
    if (!reveal) return;
    const url = URL.createObjectURL(
      new Blob([reveal], { type: "application/json" })
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = `bid-reveal-${bidId}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function loadReceipt() {
      if (!sessionToken) {
        setLoading(false);
        setBid(null);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const bids = await getApi(sessionToken).getMyBids();

        if (active) {
          const found = bids.find(
            (item) => item.id === bidId || item.receiptId === bidId
          );

          setBid(found ?? null);

          if (!found) {
            setError("This bid receipt could not be found in your wallet.");
          }
        }
      } catch (err) {
        if (active) {
          setError(
            err instanceof Error
              ? err.message
              : "Could not load this bid receipt."
          );
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    void loadReceipt();

    return () => {
      active = false;
    };
  }, [bidId, sessionToken]);

  if (loading) {
    return (
      <div className="mx-auto flex min-h-[70vh] max-w-4xl items-center justify-center px-5">
        <div className="flex items-center gap-3 text-sm text-muted">
          <Loader2 className="size-5 animate-spin" />
          Loading bid receipt...
        </div>
      </div>
    );
  }

  if (!sessionToken) {
    return (
      <div className="mx-auto max-w-4xl px-5 py-16">
        <div className="border border-line bg-bg/40 p-8 text-center">
          <Lock className="mx-auto size-8 text-seal-fg" />

          <h1 className="mt-4 text-xl font-semibold">
            Wallet authentication required
          </h1>

          <p className="mt-2 text-sm text-muted">
            Connect and authenticate the wallet that submitted this bid.
          </p>

          <Link
            href="/my-bids"
            className="mt-5 inline-flex items-center gap-2 text-sm text-seal-fg hover:underline"
          >
            <ArrowLeft className="size-4" />
            Back to My Bids
          </Link>
        </div>
      </div>
    );
  }

  if (error || !bid) {
    return (
      <div className="mx-auto max-w-4xl px-5 py-16">
        <div className="border border-danger/30 bg-danger/5 p-8 text-center">
          <h1 className="text-xl font-semibold">
            Receipt unavailable
          </h1>

          <p className="mt-2 text-sm text-muted">
            {error ?? "This bid receipt could not be found."}
          </p>

          <Link
            href="/my-bids"
            className="mt-5 inline-flex items-center gap-2 text-sm text-seal-fg hover:underline"
          >
            <ArrowLeft className="size-4" />
            Back to My Bids
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto min-h-screen max-w-4xl px-5 py-12">
      <Link
        href="/my-bids"
        className="inline-flex items-center gap-2 text-sm text-muted transition-colors hover:text-text"
      >
        <ArrowLeft className="size-4" />
        Back to My Bids
      </Link>

      <div className="mt-8 flex items-center gap-3">
        <span className="grid size-12 place-items-center bg-seal text-black">
          <ShieldCheck className="size-6" />
        </span>

        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-seal-fg">
            Bid verification record
          </p>

          <h1 className="mt-1 text-2xl font-semibold">
            Bid Receipt
          </h1>
        </div>
      </div>

      {/* Launch information */}
      <section className="mt-8 border border-line bg-bg/40 p-6">
        <div className="flex items-center gap-4">
          <div
            className="grid size-14 place-items-center text-2xl"
            style={{
              backgroundColor: `hsl(${bid.launch.hue} 35% 15%)`,
            }}
          >
            {bid.launch.emoji}
          </div>

          <div>
            <h2 className="text-xl font-semibold">
              {bid.launch.name}
            </h2>

            <p className="text-sm text-muted">
              ${bid.launch.symbol}
            </p>
          </div>

          <span
            className={`ml-auto border px-3 py-1 text-xs uppercase ${statusStyle(
              bid.paymentCheck.state
            )}`}
          >
            {bid.paymentCheck.state}
          </span>
        </div>

        <div className="mt-6 border-t border-line pt-5">
          <p className="text-xs text-muted">
            Bid submitted
          </p>

          <p className="mt-1 text-sm">
            {new Date(bid.createdAt).toLocaleString()}
          </p>

          <p className="mt-4 text-xs text-muted">
            Wallet
          </p>

          <p className="mt-1 break-all font-mono text-sm">
            {bid.bidder}
          </p>
        </div>
      </section>

      {/* Receipt identifiers */}
      <section className="mt-5 border border-line bg-bg/40 p-6">
        <h2 className="font-semibold">
          Receipt information
        </h2>

        <div className="mt-5 space-y-5">
          <div>
            <p className="text-xs text-muted">Receipt ID</p>
            <p className="mt-1 break-all font-mono text-sm">
              {bid.receiptId}
            </p>
          </div>

          <div>
            <p className="text-xs text-muted">
              Bid commitment
            </p>
            <p className="mt-1 break-all font-mono text-sm text-seal-fg">
              {bid.commitment}
            </p>
          </div>

          <div>
            <p className="text-xs text-muted">
              Bid database ID
            </p>
            <p className="mt-1 break-all font-mono text-xs text-muted">
              {bid.id}
            </p>
          </div>

          <div>
            <p className="text-xs text-muted">
              Enclave key ID
            </p>
            <p className="mt-1 break-all font-mono text-sm">
              {bid.keyId}
            </p>
          </div>
        </div>
      </section>

      {/* Payment check */}
      <section className="mt-5 border border-line bg-bg/40 p-6">
        <h2 className="font-semibold">
          Payment check
        </h2>

        <div className="mt-5 grid gap-5 sm:grid-cols-2">
          <div>
            <p className="text-xs text-muted">
              Payment-check ID
            </p>
            <p className="mt-1 break-all font-mono text-xs">
              {bid.paymentCheckId}
            </p>
          </div>

          <div>
            <p className="text-xs text-muted">
              Payment token
            </p>
            <p className="mt-1 font-mono text-sm">
              {bid.paymentCheck.token}
            </p>
          </div>

          <div>
            <p className="text-xs text-muted">
              Payment-check amount
            </p>
            <p className="mt-1 font-mono text-lg">
              {bid.paymentCheck.amount.toLocaleString(undefined, {
                style: "currency",
                currency: "USD",
              })}
            </p>
            <p className="mt-1 text-xs text-faint">
              Collateral amount, not your bid price.
            </p>
          </div>

          <div>
            <p className="text-xs text-muted">
              Expiration
            </p>
            <p className="mt-1 text-sm">
              {new Date(bid.paymentCheck.expiresAt).toLocaleString()}
            </p>
          </div>
        </div>
      </section>

      {reveal && (
        <section className="mt-5 border border-seal/30 bg-seal/5 p-6">
          <h2 className="font-semibold">Private bid reveal file</h2>
          <p className="mt-1 text-xs leading-relaxed text-muted">
            Contains your bid values and salt. Keep it private until the
            auction has closed. It is only kept in this browser tab.
          </p>
          <button
            onClick={downloadReveal}
            className="mt-3 border border-seal px-5 py-3 text-sm text-seal-fg hover:bg-seal/5"
          >
            Download reveal file
          </button>
        </section>
      )}

      {/* Actions */}
      <div className="mt-5 flex flex-wrap gap-3">
        <Link
          href={`/launches/${encodeURIComponent(bid.launchId)}`}
          className="inline-flex items-center gap-2 border border-seal px-5 py-3 text-sm text-seal-fg hover:bg-seal/5"
        >
          View launch
          <ExternalLink className="size-4" />
        </Link>

        <Link
          href="/my-bids"
          className="inline-flex items-center gap-2 border border-line-strong px-5 py-3 text-sm hover:bg-white/5"
        >
          All my bids
        </Link>
      </div>

    </div>
  );
}
