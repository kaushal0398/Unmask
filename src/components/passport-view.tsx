"use client";

import { ArrowLeft, Loader2 } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Badge, Card, Mono } from "@/components/ui";
import { getApi } from "@/lib/api";
import type { Launch } from "@/lib/demo";
import { usd } from "@/lib/format";
import { accessKeys, NEAR_EXPLORER, NO_CODE, RpcError, viewAccount, viewCall } from "@/lib/near-rpc";

type Severity = "info" | "low" | "medium" | "high" | "unknown";
type Basis = "verified" | "heuristic" | "unknown";
type Finding = { id: string; title: string; severity: Severity; basis: Basis; detail: string; evidence: string };

const RULES_VERSION = "passport-rules/1";

/** Deterministic checks over the launch record. Anything we cannot read is reported "unknown", never guessed. */
export function checksFor(l: Launch): Finding[] {
  const out: Finding[] = [];
  const capShare = l.cap;

  out.push(
    l.reserve > 0
      ? { id: "reserve", title: "Reserve price set", severity: "info", basis: "verified", detail: "Bids below the reserve are excluded.", evidence: `reserve = ${usd(l.reserve)} (launch record)` }
      : { id: "reserve", title: "No reserve price", severity: "medium", basis: "verified", detail: "Without a reserve the whole supply could clear at a near-zero price.", evidence: "reserve = 0 (launch record)" },
  );

  if (capShare === null) {
    out.push({ id: "cap", title: "No per-account cap", severity: "medium", basis: "verified", detail: "One wallet, or many wallets it controls, can take any share of the supply.", evidence: "cap = none (launch record)" });
  } else if (capShare > 0.25) {
    out.push({ id: "cap", title: "High per-account cap", severity: "medium", basis: "verified", detail: `One account may take up to ${Math.round(capShare * 100)}% of supply.`, evidence: `cap = ${capShare * 100}% (launch record)` });
  } else {
    out.push({ id: "cap", title: "Per-account cap limits concentration", severity: "info", basis: "verified", detail: `Up to ${Math.round(capShare * 100)}% per account. A cap does not stop one person using several wallets.`, evidence: `cap = ${capShare * 100}% (launch record)` });
  }

  out.push(
    l.codeHash
      ? { id: "code", title: "Auction code hash published", severity: "info", basis: "verified", detail: "The auction engine identity is recorded before bids are accepted.", evidence: `codeHash = ${l.codeHash}` }
      : { id: "code", title: "No auction code hash", severity: "high", basis: "verified", detail: "Participants cannot tell which code will compute the result.", evidence: "codeHash missing (launch record)" },
  );

  out.push(
    l.tokenContract
      ? { id: "contract", title: "Token contract recorded", severity: "info", basis: "verified", detail: "A contract address is attached to this launch.", evidence: `tokenContract = ${l.tokenContract}` }
      : { id: "contract", title: "No token contract recorded", severity: "high", basis: "verified", detail: "There is no contract to inspect.", evidence: "tokenContract missing (launch record)" },
  );

  return out;
}

const unknown = (id: string, title: string, why: string): Finding => ({ id, title, severity: "unknown", basis: "unknown", detail: why, evidence: "No answer from the NEAR RPC" });
const acct = (a: string) => `${NEAR_EXPLORER}/address/${a}`;

/** Live NEAR RPC reads (testnet unless NEXT_PUBLIC_NEAR_RPC_URL says otherwise). Each check fails to "unknown", never to a guess. */
export async function chainChecks(l: Launch): Promise<Finding[]> {
  const out: Finding[] = [];
  const tc = l.tokenContract;

  if (!tc) {
    return [unknown("onchain", "On-chain token checks", "This launch has no token contract recorded, so nothing could be read.")];
  }

  let hasContract = false;
  try {
    const a = await viewAccount(tc);
    hasContract = a.code_hash !== NO_CODE;
    out.push(hasContract
      ? { id: "deployed", title: "Token contract is deployed", severity: "info", basis: "verified", detail: "Code is deployed on this account.", evidence: `${acct(tc)} · code_hash ${a.code_hash}` }
      : { id: "deployed", title: "Account has no contract code", severity: "high", basis: "verified", detail: "The account exists but holds no contract, so there is no token to inspect.", evidence: acct(tc) });
  } catch (e) {
    out.push(e instanceof RpcError && e.kind === "unknown_account"
      ? { id: "deployed", title: "Token contract not found on this network", severity: "high", basis: "verified", detail: "The RPC reports no such account. The token may not be deployed, or the address belongs to another network.", evidence: `view_account ${tc} -> unknown account` }
      : unknown("deployed", "Token contract deployment", "The RPC call failed, so this could not be checked."));
    return out;
  }

  // Upgrade authority: a full-access key can redeploy the contract code.
  try {
    const { keys } = await accessKeys(tc);
    const full = keys.filter((k) => k.access_key.permission === "FullAccess");
    out.push(full.length === 0
      ? { id: "upgrade", title: "No full-access keys: code cannot be changed", severity: "info", basis: "verified", detail: "No key on the contract account can redeploy it. (A contract could still upgrade itself in code; that is not visible here.)", evidence: `view_access_key_list ${tc} -> ${keys.length} limited key(s)` }
      : { id: "upgrade", title: "Contract can be upgraded by a full-access key", severity: "medium", basis: "verified", detail: `${full.length} full-access key(s) can redeploy the code or move the account's funds, so the token's rules can change.`, evidence: `view_access_key_list ${tc} -> ${full.map((k) => k.public_key).join(", ")}` });
  } catch {
    out.push(unknown("upgrade", "Upgrade authority", "The access-key list could not be read."));
  }

  // Supply and creator holding (NEP-141 views).
  let decimals = 0, total = 0n;
  try {
    decimals = (await viewCall<{ decimals: number }>(tc, "ft_metadata")).decimals;
    total = BigInt(await viewCall<string>(tc, "ft_total_supply"));
    const onChain = Number(total / 10n ** BigInt(Math.max(decimals - 2, 0))) / 10 ** Math.min(decimals, 2);
    const ok = Math.abs(onChain - l.supply) <= l.supply * 1e-9;
    out.push(ok
      ? { id: "supply", title: "On-chain supply matches the launch", severity: "info", basis: "verified", detail: "ft_total_supply equals the supply offered.", evidence: `ft_total_supply ${tc} -> ${onChain}` }
      : { id: "supply", title: "On-chain supply differs from the launch", severity: "medium", basis: "verified", detail: `The contract reports ${onChain}, the launch says ${l.supply}.`, evidence: `ft_total_supply ${tc} -> ${onChain}` });
  } catch (e) {
    out.push(unknown("supply", "Token supply", e instanceof RpcError && e.kind === "no_method" ? "The contract does not expose the standard NEP-141 views, so supply could not be read." : "Supply could not be read."));
  }

  if (total > 0n) {
    try {
      const bal = BigInt(await viewCall<string>(tc, "ft_balance_of", { account_id: l.creator }));
      const pct = Number((bal * 10000n) / total) / 100;
      out.push({ id: "creator-share", title: `Creator wallet holds ${pct}% of supply`, severity: "info", basis: "verified", detail: "Measured now. Tokens offered in the auction usually sit with the creator or a contract until settlement, so a high share before the sale is expected. This only covers the creator wallet, not other holders.", evidence: `ft_balance_of ${l.creator} -> ${bal}` });
    } catch {
      out.push(unknown("creator-share", "Creator holding", "The creator's balance could not be read."));
    }
  }

  try {
    const c = await viewAccount(l.creator);
    out.push({ id: "creator", title: "Creator account exists", severity: "info", basis: "verified", detail: "Only existence and balance are checked. Transaction history needs an indexer and is not checked, so no claim is made about it.", evidence: `${acct(l.creator)} · balance ${(Number(BigInt(c.amount) / 10n ** 21n) / 1000).toFixed(3)} NEAR` });
  } catch (e) {
    out.push(e instanceof RpcError && e.kind === "unknown_account"
      ? { id: "creator", title: "Creator account not found on this network", severity: "medium", basis: "verified", detail: "The RPC reports no such account.", evidence: `view_account ${l.creator} -> unknown account` }
      : unknown("creator", "Creator account", "The RPC call failed."));
  }

  if (hasContract) {
    out.push(unknown("authorities", "Mint, pause and freeze functions", "There is no standard on-chain way to list a contract's privileged methods. This needs the contract source or an audit, so no claim is made."));
  }
  out.push(unknown("liquidity", "Liquidity setup and lock", "This product does not create a pool yet, so there is nothing to read."));
  out.push(unknown("holders", "Full holder distribution", "The RPC cannot list token holders. This needs an indexer."));
  return out;
}

export function bandOf(f: Finding[]): "Low" | "Medium" | "High" {
  if (f.some((x) => x.severity === "high")) return "High";
  if (f.some((x) => x.severity === "medium")) return "Medium";
  return "Low";
}

const tone = (s: Severity) => (s === "high" ? "danger" : s === "medium" ? "seal" : s === "info" || s === "low" ? "verified" : "neutral");

export function PassportView({ id }: { id: string }) {
  const [launch, setLaunch] = useState<Launch | null | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const [chain, setChain] = useState<Finding[] | null>(null);
  const [reviewedAt] = useState(() => new Date());

  useEffect(() => {
    let live = true;
    getApi().getLaunch(id).then((l) => live && setLaunch(l)).catch((e) => live && setError(e instanceof Error ? e.message : "Could not load the launch."));
    return () => { live = false; };
  }, [id]);

  useEffect(() => {
    if (!launch) return;
    let live = true;
    chainChecks(launch).then((f) => live && setChain(f)).catch(() => live && setChain([unknown("onchain", "On-chain checks", "The NEAR RPC could not be reached.")]));
    return () => { live = false; };
  }, [launch]);

  if (error) return <p className="py-16 text-center text-danger" role="alert">{error}</p>;
  if (launch === undefined) return <p className="flex items-center justify-center gap-2 py-16 text-muted"><Loader2 className="size-4 animate-spin" /> Loading…</p>;
  if (!launch) return <p className="py-16 text-center text-muted">Launch not found.</p>;

  const findings = [...checksFor(launch), ...(chain ?? [])];
  const band = bandOf(findings);
  const unknowns = findings.filter((f) => f.severity === "unknown").length;

  return (
    <div className="space-y-6">
      <Link href={`/launches/${encodeURIComponent(launch.id)}`} className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-text">
        <ArrowLeft className="size-4" /> {launch.name}
      </Link>
      <div>
        <p className="text-xs uppercase tracking-[0.2em] text-seal-fg">Launch Risk Passport</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">{launch.name} <span className="font-mono text-muted">${launch.symbol}</span></h1>
        <div className="mt-3 flex flex-wrap gap-2">
          <Badge tone={band === "High" ? "danger" : band === "Medium" ? "seal" : "verified"}>Risk on checks run: {band}</Badge>
          <Badge>{unknowns} checks not run</Badge>
        </div>
        <p className="mt-3 max-w-2xl text-sm text-muted">
          Based only on the checks below. A &quot;Low&quot; band does not mean safe: {unknowns} checks could not be done. This is not a security audit.
        </p>
      </div>

      {chain === null && <p className="flex items-center gap-2 text-sm text-muted"><Loader2 className="size-4 animate-spin" /> Reading the token contract from the NEAR RPC…</p>}
      <div className="space-y-3">
        {findings.map((f) => (
          <Card key={f.id} className="p-5">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone={tone(f.severity)}>{f.severity}</Badge>
              <Badge>{f.basis === "verified" ? "verified fact" : f.basis === "heuristic" ? "heuristic" : "unknown"}</Badge>
              <h2 className="font-semibold">{f.title}</h2>
            </div>
            <p className="mt-2 text-sm text-muted">{f.detail}</p>
            <p className="mt-2 text-xs text-faint">Evidence: <Mono className="break-all">{f.evidence}</Mono></p>
          </Card>
        ))}
      </div>

      <p className="text-xs text-faint">Reviewed {reviewedAt.toLocaleString()} · rules {RULES_VERSION} · no AI model was used for these findings. On-chain reads come from the NEAR RPC at review time.</p>
    </div>
  );
}
