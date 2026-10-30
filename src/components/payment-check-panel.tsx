"use client";

import { AlertTriangle, Loader2, RotateCcw } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useToast } from "@/components/toast";
import { Badge, Button, Mono } from "@/components/ui";
import { getApi } from "@/lib/api";
import { ApiError, type PaymentCheck, type PaymentCheckState } from "@/lib/api/types";
import { usd } from "@/lib/format";

const COPY: Record<PaymentCheckState, { tone: "seal" | "verified" | "danger" | "neutral"; label: string; help: string }> = {
  creating: { tone: "neutral", label: "creating", help: "Locking the funds. This takes a few seconds." },
  locked: { tone: "seal", label: "locked", help: "The most you could owe is held for this bid. Anything unused comes back." },
  failed: { tone: "danger", label: "failed", help: "The funds were not locked, so nothing was taken." },
  expired: { tone: "danger", label: "expired, funds still held", help: "An expired check cannot be used for new bids, but the funds are still in it until you reclaim them." },
  reclaimed: { tone: "neutral", label: "reclaimed", help: "The funds are back in your balance." },
  claimed: { tone: "verified", label: "settled", help: "The enclave claimed what you owed; the rest went back to you." },
};

/** Where the money behind a bid is, with the one action that matters: take it back. */
export function PaymentCheckPanel({ checkId, onChange }: { checkId: string; onChange?: (c: PaymentCheck) => void }) {
  const toast = useToast();
  const [check, setCheck] = useState<PaymentCheck | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let live = true;
    const poll = async () => {
      const c = await getApi().getPaymentCheck(checkId);
      if (live && c) {
        setCheck((prev) => (prev?.state === c.state && prev.amount === c.amount ? prev : c));
        onChange?.(c);
      }
    };
    void poll();
    const t = setInterval(() => void poll(), 2500);
    return () => {
      live = false;
      clearInterval(t);
    };
  }, [checkId, onChange]);

  const reclaim = useCallback(async () => {
    setBusy(true);
    try {
      const c = await getApi().reclaimPaymentCheck(checkId);
      setCheck(c);
      onChange?.(c);
      toast("Funds reclaimed.", "ok");
    } catch (e) {
      toast(e instanceof ApiError ? e.message : "Could not reclaim the funds. Try again.", "error");
    } finally {
      setBusy(false);
    }
  }, [checkId, onChange, toast]);

  if (!check) return <p className="flex items-center gap-2 text-xs text-muted"><Loader2 className="size-3.5 animate-spin" /> Checking your payment check…</p>;
  const c = COPY[check.state];
  const canReclaim = check.state === "locked" || check.state === "expired";
  return (
    <div className="border border-line bg-black/40 p-4 text-sm" aria-live="polite">
      <div className="flex items-center justify-between gap-3">
        <span className="text-muted">Payment check <Mono className="text-faint">{check.id}</Mono></span>
        <Badge tone={c.tone}>{c.label}</Badge>
      </div>
      <p className="mt-2 flex items-start gap-2 text-xs leading-relaxed text-muted">
        {check.state === "expired" && <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-danger" />}
        {c.help}
      </p>
      <div className="mt-3 flex items-center justify-between">
        <Mono>{usd(check.amount)} {check.token}</Mono>
        {canReclaim && check.state === "expired" && (
          <Button tone="seal" onClick={() => void reclaim()} disabled={busy} className="py-1.5 text-xs">
            {busy ? <Loader2 className="size-3.5 animate-spin" /> : <RotateCcw className="size-3.5" />} Reclaim funds
          </Button>
        )}
      </div>
    </div>
  );
}
