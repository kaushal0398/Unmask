/**
 * What the wallet is asked to sign for each action (NEP-413, no gas). Plain text, so the user can read it in the
 * wallet. Must match backend/src/action-sig.ts character for character: the backend rebuilds this message from the
 * request and rejects the signature if anything differs.
 */
export const ACTION_RECIPIENT = "unmask.action";

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

export async function actionNonce(message: string): Promise<Uint8Array> {
  return new Uint8Array(await globalThis.crypto.subtle.digest("SHA-256", new TextEncoder().encode(message)));
}
