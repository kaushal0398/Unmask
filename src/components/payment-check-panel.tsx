
"use client";

import { AlertTriangle, Loader2, RotateCcw } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useToast } from "@/components/toast";
import { useWallet } from "@/components/wallet";
import { Badge, Button, Mono } from "@/components/ui";
import { getApi } from "@/lib/api";
import {
  ApiError,
  type PaymentCheck,
  type PaymentCheckState,
} from "@/lib/api/types";
import { usd } from "@/lib/format";

const COPY: Record<
  PaymentCheckState,
  { tone: "seal" | "verified" | "danger" | "neutral"; label: string; help: string }
> = {
  creating: {
    tone: "neutral",
    label: "creating",
    help: "Locking the funds. This takes a few seconds.",
  },
  locked: {
    tone: "seal",
    label: "locked",
    help: "The most you could owe is held for this bid. Anything unused comes back.",
  },
  failed: {
    tone: "danger",
    label: "failed",
    help: "The funds were not locked, so nothing was taken.",
  },
  expired: {
    tone: "danger",
    label: "expired, funds still held",
    help: "An expired check cannot be used for new bids, but the funds are still in it until you reclaim them.",
  },
  reclaimed: {
    tone: "neutral",
    label: "reclaimed",
    help: "The funds are back in your balance.",
  },
  claimed: {
    tone: "verified",
    label: "settled",
    help: "The enclave claimed what you owed; the rest went back to you.",
  },
};

/** Where the money behind a bid is, with the one action that matters: take it back. */
export function PaymentCheckPanel({
  checkId,
  onChange,
}: {
  checkId: string;
  onChange?: (c: PaymentCheck) => void;
}) {
  const toast = useToast();
  const { account, auth, mode } = useWallet();

  const sessionToken =
    account && auth?.token && mode === "real" ? auth.token : undefined;

  const [check, setCheck] = useState<PaymentCheck | null>(null);
  const [busy, setBusy] = useState(false);

  // Poll only when the real wallet has an authenticated session.
  useEffect(() => {
    let live = true;

    if (!sessionToken) {
      setCheck(null);

      return () => {
        live = false;
      };
    }

    const poll = async () => {
      try {
        const c = await getApi(sessionToken).getPaymentCheck(checkId);

        if (live && c) {
          setCheck((prev) =>
            prev?.state === c.state && prev.amount === c.amount ? prev : c
          );
          onChange?.(c);
        }
      } catch (error) {
        if (live) {
          console.error("Payment check polling failed:", error);
        }
      }
    };

    void poll();

    const interval = setInterval(() => {
      void poll();
    }, 2500);

    return () => {
      live = false;
      clearInterval(interval);
    };
  }, [checkId, onChange, sessionToken]);

  // Reclaim an expired payment check using the authenticated session.
  const reclaim = useCallback(async () => {
    if (!sessionToken) {
      toast("Connect and authenticate your real NEAR wallet first.", "error");
      return;
    }

    setBusy(true);

    try {
      const c = await getApi(sessionToken).reclaimPaymentCheck(checkId);

      setCheck(c);
      onChange?.(c);

      toast("Funds reclaimed.", "ok");
    } catch (error) {
      toast(
        error instanceof ApiError
          ? error.message
          : "Could not reclaim the funds. Try again.",
        "error"
      );
    } finally {
      setBusy(false);
    }
  }, [checkId, onChange, sessionToken, toast]);

  if (!check) {
    return (
      <p className="flex items-center gap-2 text-xs text-muted">
        {sessionToken ? (
          <>
            <Loader2 className="size-3.5 animate-spin" />
            Checking your payment check…
          </>
        ) : (
          "Connect and authenticate your real NEAR wallet to view this payment check."
        )}
      </p>
    );
  }

  const c = COPY[check.state];
  const canReclaim = check.state === "locked" || check.state === "expired";

  return (
    <div
      className="border border-line bg-bg/40 p-4 text-sm"
      aria-live="polite"
    >
      <div className="flex items-center justify-between gap-3">
        <span className="text-muted">
          Payment check <Mono className="text-faint">{check.id}</Mono>
        </span>

        <Badge tone={c.tone}>{c.label}</Badge>
      </div>

      <p className="mt-2 flex items-start gap-2 text-xs leading-relaxed text-muted">
        {check.state === "expired" && (
          <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-danger" />
        )}
        {c.help}
      </p>

      <div className="mt-3 flex items-center justify-between">
        <Mono>
          {usd(check.amount)} {check.token}
        </Mono>

        {canReclaim && check.state === "expired" && (
          <Button
            tone="seal"
            onClick={() => void reclaim()}
            disabled={busy || !sessionToken}
            className="py-1.5 text-xs"
          >
            {busy ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <RotateCcw className="size-3.5" />
            )}
            Reclaim funds
          </Button>
        )}
      </div>
    </div>
  );
}
