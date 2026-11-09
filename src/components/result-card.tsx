"use client";

import { Bot, Copy, Download } from "lucide-react";
import { useState } from "react";
import { useToast } from "@/components/toast";
import { Button, Mono, cx } from "@/components/ui";
import { tokens, usd } from "@/lib/format";
import { STATUS_TEXT, cardSvg, cardText, type CardData } from "@/lib/result-card";

/** Draw the card's SVG onto a canvas and save it as a PNG. Runs only in the browser. */
async function downloadPng(card: CardData) {
  const svg = cardSvg(card);
  const url = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" }));
  try {
    const img = new Image();
    await new Promise<void>((ok, fail) => { img.onload = () => ok(); img.onerror = () => fail(new Error("image")); img.src = url; });
    const canvas = document.createElement("canvas");
    canvas.width = 1200;
    canvas.height = 630;
    canvas.getContext("2d")!.drawImage(img, 0, 0, 1200, 630);
    const png = await new Promise<Blob | null>((ok) => canvas.toBlob(ok, "image/png"));
    if (!png) throw new Error("png");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(png);
    a.download = `unmask-${card.symbol.toLowerCase()}-result.png`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  } finally {
    URL.revokeObjectURL(url);
  }
}

const TONE: Record<CardData["status"], string> = { won: "border-verified text-verified", partly: "border-price text-price", lost: "border-line-strong text-muted" };

/** Your result, in plain numbers, with a shareable image. Nothing here was sealed: it is all in the public result. */
export function ResultCard({ card }: { card: CardData }) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);

  async function save() {
    setBusy(true);
    try {
      await downloadPng(card);
    } catch {
      toast("Could not make the image in this browser. Copy the text instead.", "error");
    } finally {
      setBusy(false);
    }
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(cardText(card));
      toast("Copied. Nothing private is in it.", "ok");
    } catch {
      toast("Could not copy. Select the text yourself.", "error");
    }
  }

  const rows: Array<[string, string]> = [
    ["Paid", usd(card.paid)],
    ["Refunded", usd(card.refunded)],
    ["Effective price", card.effectivePrice === null ? "—" : usd(card.effectivePrice)],
    ["My limit", usd(card.limit)],
    ["Saved against my limit", card.savedVsLimit === null ? "—" : usd(card.savedVsLimit)],
  ];

  return (
    <div className={cx("border-2 bg-bg p-6 sm:p-8", TONE[card.status].split(" ")[0])} data-testid="result-card">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className={cx("text-xs font-bold uppercase tracking-[0.2em]", TONE[card.status].split(" ")[1])}>Your result · {STATUS_TEXT[card.status]}</p>
          <p className="mt-3 font-mono text-4xl font-medium tabular-nums tracking-tight sm:text-5xl">{card.got > 0 ? `${tokens(card.got)} ${card.symbol}` : "Priced out"}</p>
          <p className="mt-2 flex items-center gap-2 text-sm text-muted">
            <Mono>{card.bidder}</Mono>
            {card.agent && <span className="inline-flex items-center gap-1 border border-near/50 px-2 py-0.5 text-xs text-near"><Bot className="size-3" /> agent bid{card.agent.signed ? ", signed rules" : ""}</span>}
          </p>
        </div>
        <div className="text-right">
          <p className="text-xs uppercase tracking-wider text-faint">everyone paid</p>
          <p className="font-mono text-3xl tabular-nums text-text">{usd(card.clearingPrice)}</p>
        </div>
      </div>
      <dl className="mt-6 grid grid-cols-2 gap-x-6 gap-y-3 border-t border-line pt-5 text-sm sm:grid-cols-5">
        {rows.map(([k, v]) => (
          <div key={k}>
            <dt className="text-xs text-faint">{k}</dt>
            <dd className="mt-1 font-mono tabular-nums">{v}</dd>
          </div>
        ))}
      </dl>
      <div className="mt-6 flex flex-wrap items-center gap-3">
        <Button type="button" tone="ghost" onClick={() => void save()} disabled={busy}><Download className="size-4" /> Save as image</Button>
        <Button type="button" tone="ghost" onClick={() => void copy()}><Copy className="size-4" /> Copy summary</Button>
        <span className="text-xs text-faint">{card.mode === "tee" ? "Attested result." : "Development result: reproducible, not attested."}</span>
      </div>
    </div>
  );
}
