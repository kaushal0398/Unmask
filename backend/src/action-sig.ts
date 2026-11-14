import { createHash } from "node:crypto";
import { verifyMessage } from "near-api-js/nep413";
import type { Provider } from "near-api-js";

/**
 * A wallet signature (NEP-413, no gas) over one specific action, so launching and bidding each need the owner's
 * approval in their wallet, not only the session from sign-in. The message is plain text the wallet shows the user.
 * It is bound to the action's details and an issue time, so a signature cannot be reused for another launch,
 * another bid or an old request. Mirrors src/lib/action.ts in the frontend (same strings).
 */
export const ACTION_RECIPIENT = "unmask.action";
export const MAX_AGE_MS = 5 * 60_000;

export type ActionSig = { message: string; publicKey: string; signature: string };

export const createMessage = (a: { account: string; name: string; symbol: string; supplyAtomic: string; reserveAtomic: string; closesAt: string; issuedAt: string }) =>
  [
    "Unmask: create a launch",
    `Account: ${a.account}`,
    `Token: ${a.name} ($${a.symbol.toUpperCase()})`,
    `Supply (atomic): ${a.supplyAtomic}`,
    `Reserve (atomic): ${a.reserveAtomic}`,
    `Bidding closes: ${a.closesAt}`,
    `Issued: ${a.issuedAt}`,
  ].join("\n");

export const bidMessage = (a: { account: string; launchId: string; commitment: string; issuedAt: string }) =>
  ["Unmask: place a sealed bid", `Account: ${a.account}`, `Launch: ${a.launchId}`, `Bid commitment: ${a.commitment}`, "The bid amount stays sealed.", `Issued: ${a.issuedAt}`].join("\n");

export const actionNonce = (message: string) => new Uint8Array(createHash("sha256").update(message).digest());

export const issuedAtOf = (message: string) => /^Issued: (.+)$/m.exec(message)?.[1];

/** `null` when the signature is valid for exactly this action, otherwise the reason it is not. */
export async function checkActionSignature(
  sig: unknown,
  account: string,
  expected: (issuedAt: string) => string,
  provider: Pick<Provider, "viewAccessKey">,
  now: Date = new Date(),
): Promise<string | null> {
  const s = sig as Partial<ActionSig> | null;
  if (!s || typeof s.message !== "string" || typeof s.publicKey !== "string" || typeof s.signature !== "string") return "missing wallet signature";
  const issuedAt = issuedAtOf(s.message);
  const issued = issuedAt ? Date.parse(issuedAt) : NaN;
  if (!Number.isFinite(issued)) return "signature has no valid issue time";
  if (Math.abs(now.getTime() - issued) > MAX_AGE_MS) return "signature is too old or from the future";
  if (s.message !== expected(issuedAt!)) return "signature is for a different action";
  try {
    const bytes = Buffer.from(s.signature, "base64");
    if (bytes.length !== 64) throw new Error("bad signature length");
    await verifyMessage({
      signerAccountId: account,
      signerPublicKey: s.publicKey,
      payload: { message: s.message, recipient: ACTION_RECIPIENT, nonce: actionNonce(s.message) },
      signature: new Uint8Array(bytes),
      provider: provider as Provider,
    });
  } catch {
    return "wallet signature is invalid";
  }
  return null;
}
