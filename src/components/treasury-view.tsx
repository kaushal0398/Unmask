"use client";

import { Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { Badge, Card, Mono } from "@/components/ui";

const CONTRACT = process.env.NEXT_PUBLIC_TREASURY_CONTRACT;
const RPC = process.env.NEXT_PUBLIC_NEAR_RPC_URL ?? "https://rpc.testnet.near.org";
const YOCTO = 10n ** 24n;

type Cat = { name: string; share_bps: number; cap: string; spent: string; reserved: string; available: string };
type Prop = { id: number; category: string; receiver: string; amount: string; reason: string; proposer: string; approvals: string[]; unlocks_ns: string; status: "Pending" | "Executed" | "Cancelled" };
type Cfg = [string[], number, string, string];

async function view<T>(method: string, args: object = {}): Promise<T> {
  const res = await fetch(RPC, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0", id: "t", method: "query",
      params: { request_type: "call_function", finality: "final", account_id: CONTRACT, method_name: method, args_base64: btoa(JSON.stringify(args)) },
    }),
  });
  const body = await res.json();
  if (body.error || body.result?.error) throw new Error(body.result?.error ?? body.error?.data ?? "RPC error");
  return JSON.parse(new TextDecoder().decode(new Uint8Array(body.result.result))) as T;
}

const near = (y: string) => {
  const v = BigInt(y);
  return `${v / YOCTO}.${(v % YOCTO).toString().padStart(24, "0").slice(0, 3)} NEAR`;
};

export function TreasuryView() {
  const [data, setData] = useState<{ cfg: Cfg; cats: Cat[]; props: Prop[] } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!CONTRACT) return;
    let live = true;
    Promise.all([view<Cfg>("get_config"), view<Cat[]>("policy"), view<Prop[]>("get_proposals")])
      .then(([cfg, cats, props]) => live && setData({ cfg, cats, props }))
      .catch((e) => live && setError(e instanceof Error ? e.message : "Could not read the contract."));
    return () => { live = false; };
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs uppercase tracking-[0.2em] text-seal-fg">Community treasury</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">Policy-controlled proceeds</h1>
        <p className="mt-3 max-w-2xl text-sm text-muted">
          Everything below is read live from the treasury contract. The contract, not this page, rejects spending outside the policy,
          requires the approval threshold, and enforces the timelock.
        </p>
      </div>

      {!CONTRACT ? (
        <Card className="p-6 text-sm text-muted">
          No treasury contract is configured for this deployment (<Mono>NEXT_PUBLIC_TREASURY_CONTRACT</Mono> is not set), so there is
          nothing to show. This page does not display example data. See <Mono>docs/TREASURY_POLICY.md</Mono> to deploy one.
        </Card>
      ) : error ? (
        <p className="py-10 text-center text-danger" role="alert">{error}</p>
      ) : !data ? (
        <p className="flex items-center justify-center gap-2 py-10 text-muted"><Loader2 className="size-4 animate-spin" /> Reading {CONTRACT}…</p>
      ) : (
        <>
          <Card className="p-6">
            <dl className="grid gap-4 text-sm sm:grid-cols-4">
              <div><dt className="text-muted">Contract</dt><dd className="mt-1 break-all"><Mono>{CONTRACT}</Mono></dd></div>
              <div><dt className="text-muted">Total received</dt><dd className="mt-1"><Mono>{near(data.cfg[3])}</Mono></dd></div>
              <div><dt className="text-muted">Approvals needed</dt><dd className="mt-1"><Mono>{data.cfg[1]} of {data.cfg[0].length}</Mono></dd></div>
              <div><dt className="text-muted">Timelock</dt><dd className="mt-1"><Mono>{Math.round((Number(data.cfg[2]) / 3.6e12) * 100) / 100} h</Mono></dd></div>
            </dl>
          </Card>

          <Card className="p-6">
            <h2 className="font-semibold">Allocation policy (fixed at deployment)</h2>
            <div className="mt-3 overflow-x-auto">
              <table className="w-full min-w-[560px] text-sm">
                <thead><tr className="border-b border-line text-left text-xs uppercase tracking-wider text-faint">
                  <th className="py-2 pr-3 font-medium">Category</th><th className="px-3 font-medium">Share</th><th className="px-3 text-right font-medium">Cap</th><th className="px-3 text-right font-medium">Spent</th><th className="px-3 text-right font-medium">Reserved</th><th className="pl-3 text-right font-medium">Available</th>
                </tr></thead>
                <tbody>{data.cats.map((c) => (
                  <tr key={c.name} className="border-b border-line/60">
                    <td className="py-2.5 pr-3">{c.name}</td><td className="px-3"><Mono>{c.share_bps / 100}%</Mono></td>
                    <td className="px-3 text-right"><Mono>{near(c.cap)}</Mono></td><td className="px-3 text-right"><Mono>{near(c.spent)}</Mono></td>
                    <td className="px-3 text-right"><Mono>{near(c.reserved)}</Mono></td><td className="pl-3 text-right"><Mono>{near(c.available)}</Mono></td>
                  </tr>))}</tbody>
              </table>
            </div>
          </Card>

          <Card className="p-6">
            <h2 className="font-semibold">Payout requests</h2>
            {data.props.length === 0 ? <p className="mt-3 text-sm text-muted">No requests yet.</p> : (
              <ul className="mt-3 space-y-3">{data.props.map((p) => (
                <li key={p.id} className="border border-line p-4 text-sm">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone={p.status === "Executed" ? "verified" : p.status === "Cancelled" ? "danger" : "seal"}>{p.status}</Badge>
                    <span className="font-medium">{p.category}</span><Mono>{near(p.amount)}</Mono><span className="text-muted">to</span><Mono className="break-all">{p.receiver}</Mono>
                  </div>
                  <p className="mt-2 text-muted">{p.reason}</p>
                  <p className="mt-1 text-xs text-faint">Approvals {p.approvals.length}/{data.cfg[1]} · unlocks {new Date(Number(p.unlocks_ns) / 1e6).toLocaleString()}</p>
                </li>))}</ul>
            )}
          </Card>
        </>
      )}
    </div>
  );
}
