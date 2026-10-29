"use client";

import Link from "next/link";
import { Wallet } from "lucide-react";
import { TokenArt } from "@/components/token-art";
import { Badge, Button, ButtonLink, Card, Mono, Stat } from "@/components/ui";
import { useWallet } from "@/components/wallet";
import { tokens, usd } from "@/lib/format";

export type Position = {
  launchId: string; name: string; symbol: string; emoji: string; hue: number;
  status: "sealed-open" | "won" | "refunded";
  limit: number; qty: number; locked: number; got: number; paid: number; refunded: number;
};

export function PortfolioView({ positions }: { positions: Position[] }) {
  const { account, connect } = useWallet();
  if (!account) {
    return (
      <Card className="mx-auto max-w-xl p-10 text-center">
        <span className="mx-auto grid size-14 place-items-center border border-seal/40 bg-seal/10 text-seal"><Wallet className="size-6" /></span>
        <h2 className="mt-5 text-xl font-semibold tracking-tight">Connect a wallet to see your bids</h2>
        <p className="mx-auto mt-2 max-w-sm text-sm text-muted">This is a demo wallet: it holds nothing and signs nothing.</p>
        <Button tone="seal" className="mt-7" onClick={connect}>Connect demo wallet</Button>
      </Card>
    );
  }
  const locked = positions.filter((p) => p.status === "sealed-open").reduce((s, p) => s + p.locked, 0);
  const paid = positions.reduce((s, p) => s + p.paid, 0);
  const back = positions.reduce((s, p) => s + p.refunded, 0);
  return (
    <div className="space-y-10">
      <dl className="grid grid-cols-2 gap-px border border-line-strong bg-line-strong shadow-[0_30px_60px_-30px_rgb(0_0_0/0.9)] lg:grid-cols-4">
        {[["Account", <Mono key="a" className="text-lg">{account}</Mono>, undefined], ["Locked in open bids", usd(locked), "seal"], ["Paid for tokens", usd(paid), undefined], ["Refunded to you", usd(back), "verified"]].map(([k, v, t]) => (
          <div key={String(k)} className="bg-surface p-6"><Stat label={String(k)} value={v as React.ReactNode} tone={t as "seal" | "verified" | undefined} /></div>
        ))}
      </dl>
      <ul className="space-y-5">
        {positions.map((p) => (
          <li key={p.launchId}>
            <Card className="p-0">
              <div className="flex flex-wrap items-center justify-between gap-4 border-b border-line p-5">
                <div className="flex items-center gap-4">
                  <TokenArt hue={p.hue} emoji={p.emoji} symbol={p.symbol} size={48} />
                  <div><p className="font-semibold">{p.name}</p><p className="font-mono text-xs text-muted">${p.symbol}</p></div>
                </div>
                {p.status === "sealed-open" ? <Badge tone="seal">sealed, bidding open</Badge> : p.status === "won" ? <Badge tone="verified">you won</Badge> : <Badge tone="neutral">priced out, refunded</Badge>}
              </div>
              <dl className="grid grid-cols-2 gap-px bg-line sm:grid-cols-5">
                {[
                  ["Your limit", p.status === "sealed-open" ? "sealed" : usd(p.limit)],
                  ["You wanted", p.status === "sealed-open" ? "sealed" : tokens(p.qty)],
                  ["You got", tokens(p.got)],
                  ["You paid", usd(p.paid)],
                  [p.status === "sealed-open" ? "Locked" : "Refunded", usd(p.status === "sealed-open" ? p.locked : p.refunded)],
                ].map(([k, v]) => (
                  <div key={k} className="bg-surface p-4"><dt className="text-[10px] uppercase tracking-wider text-faint">{k}</dt><dd className="mt-1 font-mono text-sm">{v}</dd></div>
                ))}
              </dl>
              <div className="flex flex-wrap gap-3 p-4">
                <ButtonLink href={`/launches/${p.launchId}`} tone="ghost" className="px-4 py-2">Open launch</ButtonLink>
                {p.status !== "sealed-open" && <Link href={`/verify?launch=${p.launchId}`} className="inline-flex items-center px-4 py-2 text-sm text-muted hover:text-text">Verify it</Link>}
              </div>
            </Card>
          </li>
        ))}
      </ul>
    </div>
  );
}
