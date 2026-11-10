/**
 * Verify a REAL settled launch from its public result, in the browser.
 *
 * Unlike the sample-launch checks (src/lib/verify-demo.ts), nothing here is assumed to pass. Each check is one of:
 *   pass       we recomputed it and it matches
 *   fail       we recomputed it and it does NOT match
 *   unchecked  we cannot check it from here, and we say why. Never shown as a pass.
 *
 * What it can prove: the counted bids are the ones the input hash was made from, the rule gives the same result on
 * them, the money adds up, and the published output is exactly what the engine wrote.
 * What it cannot: that no bid was dropped before the input hash was made (left-out bids are listed with reasons, but
 * their legitimacy is not checkable here), who ran the code, or that the code is the code we published.
 */
import { clearAuctionExact, type ExactAuctionInput } from "@/lib/auction-core";
import { sha256Hex } from "@/lib/verify-demo";

export type VerifyStatus = "pass" | "fail" | "unchecked";
export type VerifyCheck = { id: string; title: string; plain: string; status: VerifyStatus; detail: string; evidence: Array<[string, string]> };

export type RawFill = { bidId: string; bidder: string; limitPrice: string; requested: string; filled: string; locked: string; payment: string; refund: string };
export type RawLaunch = { id: string; supplyAtomic: string; reserveAtomic: string; tokenDecimals: number };
export type RawResult = {
  launchId: string; clearingPrice: string; sold: string; totalRaised: string; inputHash: string; codeHash: string;
  mode: "dev" | "outlayer" | "tee"; attestation: string | null;
  outcome: {
    version: string; auctionId: string; tokenDecimals: number; supply: string; clearingPrice: string; sold: string; unsold: string;
    totalRaised: string; totalLocked: string; totalRefunded: string; fills: RawFill[];
    payouts?: Array<{ kind: "refund" | "tokens"; amountAtomic: string }>;
    engineOutputHash?: string; engineKind?: "native" | "wasm" | "outlayer";
  };
};

const byteOrder = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);

/** The input the settlement hashed: the counted bids sorted by id, in a fixed key order. */
export function rebuildInput(launch: RawLaunch, fills: RawFill[]): ExactAuctionInput {
  return {
    version: "1",
    auctionId: launch.id,
    supply: launch.supplyAtomic,
    reservePrice: launch.reserveAtomic,
    tokenDecimals: launch.tokenDecimals,
    bids: [...fills].sort((a, b) => byteOrder(a.bidId, b.bidId)).map((f) => ({ id: f.bidId, bidder: f.bidder, limitPrice: f.limitPrice, quantity: f.requested })),
  };
}

/**
 * The engine's output text, rebuilt in the engine's own key order. The database stores the result as JSONB, which does not
 * keep key order, so the order has to be written out here (it matches the Rust struct, and backend/src/dev-enclave.ts).
 */
export function engineOutputText(o: RawResult["outcome"]): string {
  return JSON.stringify({
    version: o.version, auctionId: o.auctionId, tokenDecimals: o.tokenDecimals, clearingPrice: o.clearingPrice, supply: o.supply,
    sold: o.sold, unsold: o.unsold, totalRaised: o.totalRaised, totalLocked: o.totalLocked, totalRefunded: o.totalRefunded,
    fills: o.fills.map((f) => ({ bidId: f.bidId, bidder: f.bidder, limitPrice: f.limitPrice, requested: f.requested, filled: f.filled, locked: f.locked, payment: f.payment, refund: f.refund })),
  });
}

const sum = (xs: string[]) => xs.reduce((s, x) => s + BigInt(x), 0n);

export async function verifyBackendResult(launch: RawLaunch, r: RawResult): Promise<VerifyCheck[]> {
  const o = r.outcome;
  const input = rebuildInput(launch, o.fills);
  const recomputedInputHash = await sha256Hex(JSON.stringify(input));

  // Re-run the rule on exactly those bids.
  let ours: ReturnType<typeof clearAuctionExact> | null = null;
  let rerunError = "";
  try { ours = clearAuctionExact(input); } catch (e) { rerunError = e instanceof Error ? e.message : "the rule rejected the input"; }
  const mismatches: string[] = [];
  if (ours) {
    if (ours.clearingPrice !== o.clearingPrice) mismatches.push(`clearing price ${o.clearingPrice} published, ${ours.clearingPrice} by the rule`);
    if (ours.sold !== o.sold) mismatches.push(`tokens sold ${o.sold} published, ${ours.sold} by the rule`);
    if (ours.totalRaised !== o.totalRaised) mismatches.push(`raised ${o.totalRaised} published, ${ours.totalRaised} by the rule`);
    const mine = new Map(ours.fills.map((f) => [f.bidId, f]));
    for (const f of o.fills) {
      const m = mine.get(f.bidId);
      if (!m) { mismatches.push(`${f.bidder}: not in the rule's result`); continue; }
      for (const k of ["filled", "locked", "payment", "refund"] as const) if (m[k] !== f[k]) mismatches.push(`${f.bidder} ${k}: ${f[k]} published, ${m[k]} by the rule`);
    }
  }

  const locked = sum(o.fills.map((f) => f.locked)), paid = sum(o.fills.map((f) => f.payment)), refunded = sum(o.fills.map((f) => f.refund)), sold = sum(o.fills.map((f) => f.filled));
  const planRefunds = sum((o.payouts ?? []).filter((p) => p.kind === "refund").map((p) => p.amountAtomic));
  const planTokens = sum((o.payouts ?? []).filter((p) => p.kind === "tokens").map((p) => p.amountAtomic));
  const moneyProblems: string[] = [];
  if (locked !== paid + refunded) moneyProblems.push(`locked ${locked} ≠ paid ${paid} + refunded ${refunded}`);
  if (sold > BigInt(launch.supplyAtomic)) moneyProblems.push(`sold ${sold} is more than the supply ${launch.supplyAtomic}`);
  if (o.payouts && planRefunds !== refunded) moneyProblems.push(`planned refunds ${planRefunds} ≠ refunds ${refunded}`);
  if (o.payouts && planTokens !== sold) moneyProblems.push(`planned token transfers ${planTokens} ≠ tokens sold ${sold}`);
  if (paid.toString() !== o.totalRaised) moneyProblems.push(`raised ${o.totalRaised} ≠ sum of payments ${paid}`);

  const checks: VerifyCheck[] = [];

  checks.push({
    id: "code", title: "The code is the code we published", plain: "The engine that ran is the open-source auction, not something else.",
    status: "unchecked",
    detail: "A code hash is recorded, but there is no independent copy to compare it with from inside the browser. To check it yourself, build the engine from source (`sh snipe-proof-auction/build.sh`) and compare its SHA-256.",
    evidence: [["Recorded code hash", r.codeHash], ["Engine", o.engineKind ?? "unknown"]],
  });

  checks.push({
    id: "attestation", title: "A genuine enclave signed the result", plain: "Hardware, not a person, vouches for what ran.",
    status: "unchecked",
    detail: r.mode === "dev"
      ? "Not available. This was settled by the development enclave, which produces no attestation, and the backend that ran it could read every bid."
      : r.mode === "outlayer"
        ? "OutLayer returned an attestation, but this page does not verify TEE quotes. Check it with `outlayer-verify tx <hash> --network testnet` (see docs/OUTLAYER_ATTESTATION.md)."
        : "This page does not verify TEE quotes. Check it with `outlayer-verify`.",
    evidence: [["Mode", r.mode], ["Attestation", r.attestation ?? "none"]],
  });

  const inputMatches = recomputedInputHash === r.inputHash;
  checks.push({
    id: "input", title: "The enclave used exactly these bids", plain: "No counted bid was added, dropped or changed after the hash was made.",
    status: inputMatches ? "pass" : "fail",
    detail: inputMatches
      ? `We rebuilt the input from the ${o.fills.length} counted bids and hashed it ourselves: it equals the hash the settlement published. Bids that were left out are listed separately with their reasons; this check cannot judge whether those were right.`
      : "The hash of the bids shown here is NOT the hash the settlement published. The bids on this page are not the bids the engine was given.",
    evidence: [["Recomputed from the bids", recomputedInputHash], ["Published by the settlement", r.inputHash], ["Counted bids", String(o.fills.length)]],
  });

  checks.push({
    id: "result", title: "Running the rule again gives the same result", plain: "Anyone can redo the maths and get the same price and the same winners.",
    status: ours && mismatches.length === 0 ? "pass" : "fail",
    detail: ours && mismatches.length === 0
      ? `We ran the auction rule in this browser on those bids. Clearing price ${ours.clearingPrice}, ${ours.sold} tokens sold, and every allocation and payment matches.`
      : `The published result does not match the rule: ${rerunError || mismatches.slice(0, 4).join("; ")}${mismatches.length > 4 ? ` (and ${mismatches.length - 4} more)` : ""}.`,
    evidence: [["Clearing price (published)", o.clearingPrice], ["Clearing price (recomputed)", ours?.clearingPrice ?? "—"], ["Tokens sold (recomputed)", ours?.sold ?? "—"], ["Differences", String(mismatches.length)]],
  });

  checks.push({
    id: "money", title: "The money adds up", plain: "What was locked equals what was paid plus what was refunded, and the plan sends exactly that.",
    status: moneyProblems.length === 0 ? "pass" : "fail",
    detail: moneyProblems.length === 0
      ? `${locked} locked = ${paid} paid + ${refunded} refunded. The planned refunds and token transfers add up to exactly the refunds and the tokens sold. (A plan: nothing has been sent.)`
      : `The numbers do not add up: ${moneyProblems.join("; ")}.`,
    evidence: [["Locked", locked.toString()], ["Paid", paid.toString()], ["Refunded", refunded.toString()], ["Planned refunds", planRefunds.toString()], ["Tokens sold / planned", `${sold} / ${planTokens}`]],
  });

  const native = o.engineKind === "native" || o.engineKind === "wasm";
  if (o.engineOutputHash && native) {
    const rebuilt = await sha256Hex(engineOutputText(o));
    checks.push({
      id: "output", title: "The published output is exactly what the engine wrote", plain: "The result was not edited after the engine produced it.",
      status: rebuilt === o.engineOutputHash ? "pass" : "fail",
      detail: rebuilt === o.engineOutputHash
        ? "We rebuilt the engine's output text from the published numbers, in the engine's own key order, and its SHA-256 equals the output hash the settlement recorded."
        : "The output rebuilt from the published numbers does not hash to the recorded output hash. Something was changed after the engine ran.",
      evidence: [["Rebuilt output hash", rebuilt], ["Recorded output hash", o.engineOutputHash]],
    });
  } else {
    checks.push({
      id: "output", title: "The published output is exactly what the engine wrote", plain: "The result was not edited after the engine produced it.",
      status: "unchecked",
      detail: o.engineKind === "outlayer" ? "OutLayer returns the output already parsed, so the exact bytes cannot be rebuilt here. Compare it with the attestation's output hash instead." : "This settlement recorded no output hash.",
      evidence: [["Engine", o.engineKind ?? "unknown"], ["Recorded output hash", o.engineOutputHash ?? "none"]],
    });
  }
  return checks;
}

export type Verdict = { kind: "fail" | "partial" | "all"; headline: string; text: string };

/** One honest sentence about the lot. "Run fairly" is only ever said when nothing at all was left unchecked. */
export function verdictOf(checks: VerifyCheck[]): Verdict {
  const failed = checks.filter((c) => c.status === "fail"), unchecked = checks.filter((c) => c.status === "unchecked"), passed = checks.filter((c) => c.status === "pass");
  if (failed.length) return { kind: "fail", headline: "Do not trust this result", text: `${failed.length} of ${checks.length} checks failed: ${failed.map((c) => c.title.toLowerCase()).join("; ")}.` };
  if (unchecked.length) return { kind: "partial", headline: "Everything we can check from here passed", text: `${passed.length} of ${checks.length} checks passed. ${unchecked.length} could not be checked and are NOT passes: ${unchecked.map((c) => c.id).join(", ")}. Until they are, this proves the numbers are internally consistent, not that the code ran in a trusted place.` };
  return { kind: "all", headline: "This launch was run fairly", text: `All ${checks.length} checks passed.` };
}
