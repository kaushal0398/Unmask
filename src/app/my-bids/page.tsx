
"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  ArrowUpRight,
  ExternalLink,
  Loader2,
  Lock,
  RefreshCw,
  Wallet,
} from "lucide-react";

import { useWallet } from "@/components/wallet";
import { getApi } from "@/lib/api";
import type { MyBid } from "@/lib/api/types";
import { shortHash } from "@/lib/format";

function statusStyle(state: string) {
  switch (state) {
    case "locked":
      return "border-seal/40 text-seal";
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

export default function MyBidsPage() {
  const { account, auth, mode } = useWallet();

  const [bids, setBids] = useState<MyBid[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const sessionToken =
    account && auth?.token && mode === "real"
      ? auth.token
      : undefined;

  useEffect(() => {
    let active = true;

    async function loadBids() {
      if (!sessionToken) {
        setBids([]);
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const result = await getApi(sessionToken).getMyBids();

        if (active) {
          setBids(result);
        }
      } catch (err) {
        if (active) {
          setError(
            err instanceof Error
              ? err.message
              : "Could not load your bids."
          );
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    void loadBids();

    return () => {
      active = false;
    };
  }, [sessionToken]);

  async function refresh() {
    if (!sessionToken) return;

    setLoading(true);
    setError(null);

    try {
      const result = await getApi(sessionToken).getMyBids();
      setBids(result);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Could not refresh your bids."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto min-h-screen max-w-6xl px-5 py-12">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-seal">
            Your activity
          </p>

          <h1 className="mt-2 text-3xl font-semibold tracking-tight">
            My Bids
          </h1>

          <p className="mt-2 text-sm text-muted">
            Your sealed bid submissions and payment-check records.
          </p>
        </div>

        {sessionToken && (
          <button
            onClick={() => void refresh()}
            disabled={loading}
            className="flex items-center gap-2 border border-line-strong px-4 py-2 text-sm hover:bg-white/5 disabled:opacity-50"
          >
            <RefreshCw
              className={`size-4 ${loading ? "animate-spin" : ""}`}
            />
            Refresh
          </button>
        )}
      </div>

      <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3">
        <div className="border border-line bg-black/40 p-4">
          <p className="text-xs text-muted">Total bids</p>
          <p className="mt-2 font-mono text-2xl">
            {bids.length}
          </p>
        </div>

        <div className="border border-line bg-black/40 p-4">
          <p className="text-xs text-muted">Locked checks</p>
          <p className="mt-2 font-mono text-2xl">
            {bids.filter((b) => b.paymentCheck.state === "locked").length}
          </p>
        </div>

        <div className="col-span-2 border border-line bg-black/40 p-4 sm:col-span-1">
          <p className="text-xs text-muted">Wallet</p>
          <p className="mt-2 truncate font-mono text-sm">
            {account ?? "Not connected"}
          </p>
        </div>
      </div>

      {!sessionToken && (
        <div className="mt-8 border border-line bg-black/40 p-8 text-center">
          <Wallet className="mx-auto size-8 text-seal" />

          <h2 className="mt-4 text-lg font-semibold">
            Connect your wallet
          </h2>

          <p className="mt-2 text-sm text-muted">
            Connect and authenticate your real NEAR wallet to
            view your submitted bids.
          </p>

          <Link
            href="/"
            className="mt-5 inline-flex items-center gap-2 border border-line-strong px-5 py-2 text-sm hover:bg-white/5"
          >
            Go to launchpad
            <ArrowUpRight className="size-4" />
          </Link>
        </div>
      )}

      {sessionToken && loading && (
        <div className="mt-12 flex items-center justify-center gap-3 text-sm text-muted">
          <Loader2 className="size-5 animate-spin" />
          Loading your bids...
        </div>
      )}

      {sessionToken && !loading && error && (
        <div className="mt-8 border border-danger/40 bg-danger/5 p-5">
          <p className="text-sm text-danger">{error}</p>

          <button
            onClick={() => void refresh()}
            className="mt-3 text-sm underline underline-offset-4"
          >
            Try again
          </button>
        </div>
      )}

      {sessionToken && !loading && !error && bids.length === 0 && (
        <div className="mt-8 border border-line bg-black/40 p-10 text-center">
          <Lock className="mx-auto size-8 text-muted" />

          <h2 className="mt-4 text-lg font-semibold">
            No bids yet
          </h2>

          <p className="mt-2 text-sm text-muted">
            Your sealed bid submissions will appear here.
          </p>

          <Link
            href="/launches"
            className="mt-5 inline-flex items-center gap-2 border border-line-strong px-5 py-2 text-sm hover:bg-white/5"
          >
            Explore launches
            <ArrowUpRight className="size-4" />
          </Link>
        </div>
      )}

      {sessionToken && !loading && !error && bids.length > 0 && (
        <div className="mt-8 space-y-4">
          {bids.map((bid) => (
            <article
              key={bid.id}
              className="border border-line bg-black/40 p-5 sm:p-6"
            >
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div
                    className="grid size-12 place-items-center text-xl"
                    style={{
                      backgroundColor: `hsl(${bid.launch.hue} 35% 15%)`,
                    }}
                  >
                    {bid.launch.emoji}
                  </div>

                  <div>
                    <h2 className="font-semibold">
                      {bid.launch.name}
                    </h2>

                    <p className="text-xs text-muted">
                      ${bid.launch.symbol} ·{" "}
                      {new Date(bid.createdAt).toLocaleString()}
                    </p>
                  </div>
                </div>

                <span
                  className={`border px-3 py-1 text-xs uppercase ${statusStyle(
                    bid.paymentCheck.state
                  )}`}
                >
                  {bid.paymentCheck.state}
                </span>
              </div>

              <div className="mt-6 grid gap-4 sm:grid-cols-2">
                <div>
                  <p className="text-xs text-muted">
                    Receipt ID
                  </p>
                  <p className="mt-1 break-all font-mono text-xs">
                    {bid.receiptId}
                  </p>
                </div>

                <div>
                  <p className="text-xs text-muted">
                    Commitment
                  </p>
                  <p className="mt-1 font-mono text-xs text-seal">
                    {shortHash(bid.commitment, 12, 8)}
                  </p>
                </div>

                <div>
                  <p className="text-xs text-muted">
                    Payment check
                  </p>
                  <p className="mt-1 break-all font-mono text-xs">
                    {bid.paymentCheckId}
                  </p>
                </div>

                <div>
                  <p className="text-xs text-muted">
                    Payment-check amount
                  </p>
                  <p className="mt-1 font-mono text-sm">
                    {bid.paymentCheck.amount.toLocaleString(
                      undefined,
                      {
                        style: "currency",
                        currency: "USD",
                      }
                    )}{" "}
                    {bid.paymentCheck.token}
                  </p>
                </div>
              </div>

              <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4">
                <p className="text-xs text-muted">
                  Bid recorded on the backend
                </p>

                <Link
                  href={`/launches/${encodeURIComponent(bid.launchId)}`}
                  className="inline-flex items-center gap-2 text-sm text-seal hover:underline"
                >
                  View launch
                  <ExternalLink className="size-3.5" />
                </Link>
              </div>
            </article>
          ))}
        </div>
      )}

      <p className="mt-8 text-xs leading-relaxed text-faint">
        Development mode: payment checks use a mock provider.
        No real funds are transferred or locked. Bid amounts
        and decrypted bid contents are not displayed here.
      </p>
    </main>
  );
}
