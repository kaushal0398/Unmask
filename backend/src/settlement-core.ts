/**
 * Pure settlement helpers: no database, no network. Turns decrypted bids into the exact auction input
 * the enclave engine runs, and hashes it. Everything here is deterministic so anyone can redo it.
 */
import { createHash } from "node:crypto";

export type PlainBid = {
  launchId: string;
  bidder: string;
  limit: number;
  qty: number;
  paymentCheck: { id: string; key: string };
  salt: string;
};

export type ExactBidIn = { id: string; bidder: string; limitPrice: string; quantity: string };
export type ExactInput = {
  version: "1";
  auctionId: string;
  supply: string;
  reservePrice: string;
  tokenDecimals: number;
  bids: ExactBidIn[];
};

/** "0.0123" -> 12300 at 6 decimals. Rejects exponent form and extra precision so no float error leaks in. */
export function decimalToAtomic(value: number | string, decimals: number): string {
  const text = typeof value === "number" ? String(value) : value;
  if (!/^(0|[1-9][0-9]*)(\.[0-9]+)?$/.test(text)) throw new Error(`not a plain decimal: ${text}`);
  const [whole, fraction = ""] = text.split(".");
  if (fraction.length > decimals) throw new Error(`more than ${decimals} decimal places: ${text}`);
  return (BigInt(whole!) * 10n ** BigInt(decimals) + BigInt((fraction + "0".repeat(decimals)).slice(0, decimals) || "0")).toString();
}

/** The same bytes the browser hashes when it commits to a bid (src/lib/seal.ts `commitmentInput`). */
export const commitmentInput = (b: PlainBid) => JSON.stringify([b.launchId, b.bidder, b.limit, b.qty, b.paymentCheck.id, b.salt]);
export const sha256Hex = (data: string | Uint8Array) => createHash("sha256").update(data).digest("hex");

export type RowFacts = { id: string; bidder: string; commitment: string; paymentCheckId: string; checkAmountAtomic: string; checkLocked: boolean };

export type Skipped = { bidId: string; reason: string };

/** Max a bid could owe: ceil(limitPrice * quantity / 10^tokenDecimals). */
export const maxOwed = (limitPrice: string, quantity: string, tokenDecimals: number) => {
  const n = BigInt(limitPrice) * BigInt(quantity);
  const d = 10n ** BigInt(tokenDecimals);
  return n === 0n ? 0n : (n + d - 1n) / d;
};

/**
 * Keep only bids that are honest: they decrypt, belong to this launch and bidder, match their commitment,
 * are backed by a locked payment check big enough to cover the most they could owe, and are well formed.
 * Everything else is skipped with a reason, never silently dropped.
 */
export function buildInput(
  launch: { id: string; supplyAtomic: string; reserveAtomic: string; tokenDecimals: number; paymentDecimals: number },
  rows: Array<{ row: RowFacts; plain: PlainBid | null }>,
): { input: ExactInput; skipped: Skipped[] } {
  const skipped: Skipped[] = [];
  const bids: ExactBidIn[] = [];
  for (const { row, plain } of rows) {
    const skip = (reason: string) => skipped.push({ bidId: row.id, reason });
    if (!plain) { skip("could not be decrypted"); continue; }
    if (plain.launchId !== launch.id) { skip("sealed for a different launch"); continue; }
    if (plain.bidder !== row.bidder) { skip("bidder does not match"); continue; }
    if (sha256Hex(commitmentInput(plain)) !== row.commitment) { skip("commitment does not match"); continue; }
    if (plain.paymentCheck.id !== row.paymentCheckId) { skip("payment check does not match"); continue; }
    if (!row.checkLocked) { skip("payment check is not locked"); continue; }
    let limitPrice: string, quantity: string;
    try {
      limitPrice = decimalToAtomic(plain.limit, launch.paymentDecimals);
      quantity = decimalToAtomic(plain.qty, launch.tokenDecimals);
    } catch (e) { skip(e instanceof Error ? e.message : "bad amount"); continue; }
    if (BigInt(limitPrice) === 0n || BigInt(quantity) === 0n) { skip("zero price or quantity"); continue; }
    if (BigInt(row.checkAmountAtomic) < maxOwed(limitPrice, quantity, launch.tokenDecimals)) { skip("payment check does not cover the bid"); continue; }
    bids.push({ id: row.id, bidder: row.bidder, limitPrice, quantity });
  }
  bids.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  return {
    input: { version: "1", auctionId: launch.id, supply: launch.supplyAtomic, reservePrice: launch.reserveAtomic, tokenDecimals: launch.tokenDecimals, bids },
    skipped,
  };
}

/** Hash of the canonical input: published before settling so nobody can swap the bids afterwards. */
export const inputHash = (input: ExactInput) => sha256Hex(JSON.stringify(input));
