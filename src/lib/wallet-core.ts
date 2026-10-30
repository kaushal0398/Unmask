/**
 * Signing in with a NEAR wallet, kept apart from React so it can be tested with a stand-in connector. The sign-in is a
 * signed message (NEP-413): it proves the buyer holds the account without sending a transaction or spending gas.
 */
export type NearNetwork = "mainnet" | "testnet";

export type SignedIn = { accountId: string; publicKey: string; signature: string; nonce: string; message: string; recipient: string };

/** The slice of `@hot-labs/near-connect` this app uses. */
export interface ConnectorLike {
  connect(): Promise<WalletLike>;
  disconnect(): Promise<void>;
}
export interface WalletLike {
  getAccounts(): Promise<Array<{ accountId: string }>>;
  signMessage(p: { message: string; recipient: string; nonce: Uint8Array }): Promise<{ accountId: string; publicKey: string; signature: string }>;
}

export class WalletError extends Error {
  constructor(
    public readonly kind: "cancelled" | "unavailable" | "failed",
    message: string,
  ) {
    super(message);
    this.name = "WalletError";
  }
}

export const networkFromEnv = (v: string | undefined): NearNetwork => (v === "mainnet" ? "mainnet" : "testnet");
export const APP_RECIPIENT = "sealed.launch";

const hex = (b: Uint8Array) => Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
const looksCancelled = (e: unknown) => /reject|cancel|denied|closed|declin/i.test(e instanceof Error ? e.message : String(e));

/** Open the wallet picker, then ask the chosen wallet to sign a fresh message. */
export async function signInWithWallet(connector: ConnectorLike, opts: { random?: (n: number) => Uint8Array; now?: () => Date } = {}): Promise<SignedIn> {
  const random = opts.random ?? ((n: number) => globalThis.crypto.getRandomValues(new Uint8Array(n)));
  try {
    const wallet = await connector.connect();
    const [account] = await wallet.getAccounts();
    if (!account) throw new WalletError("failed", "The wallet did not return an account.");
    const nonce = random(32);
    const message = `Sign in to Sealed as ${account.accountId}. This does not move funds. ${(opts.now?.() ?? new Date()).toISOString()}`;
    const signed = await wallet.signMessage({ message, recipient: APP_RECIPIENT, nonce });
    if (!signed.signature || !signed.publicKey) throw new WalletError("failed", "The wallet returned no signature.");
    return { accountId: signed.accountId || account.accountId, publicKey: signed.publicKey, signature: signed.signature, nonce: hex(nonce), message, recipient: APP_RECIPIENT };
  } catch (e) {
    if (e instanceof WalletError) throw e;
    if (looksCancelled(e)) throw new WalletError("cancelled", "You closed the wallet before signing in.");
    throw new WalletError("failed", e instanceof Error ? e.message : "The wallet could not be reached.");
  }
}
