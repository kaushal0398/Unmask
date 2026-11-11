
/**
 * NEAR wallet authentication using backend-generated NEP-413 challenges.
 * The wallet signs a message without sending a transaction or spending gas.
 */

import { AGENT_RECIPIENT, rulesMessage, rulesNonce, type AgentRules } from "@/lib/agent";

export type NearNetwork = "mainnet" | "testnet";

export type SignedIn = {
  accountId: string;
  publicKey: string;
  signature: string;
  nonce: string;
  message: string;
  recipient: string;
  token: string;
  expiresAt: string;
};

export interface ConnectorLike {
  connect(input?: { walletId?: string }): Promise<WalletLike>;
  /** The already-connected wallet, when the connector can give it without asking again. */
  wallet?(): Promise<WalletLike>;
  disconnect(): Promise<void>;
}

export interface WalletLike {
  getAccounts(): Promise<Array<{ accountId: string }>>;
  signMessage(p: {
    message: string;
    recipient: string;
    nonce: Uint8Array;
  }): Promise<{
    accountId: string;
    publicKey: string;
    signature: string;
  }>;
}

type ChallengeResponse = {
  challenge: {
    challengeId: string;
    accountId: string;
    nonce: string;
    message: string;
    recipient: string;
    expiresAt: string;
  };
};

type VerifyResponse = {
  session: {
    accountId: string;
    token: string;
    expiresAt: string;
  };
};

export class WalletError extends Error {
  constructor(
    public readonly kind: "cancelled" | "unavailable" | "failed",
    message: string,
  ) {
    super(message);
    this.name = "WalletError";
  }
}

export const networkFromEnv = (
  value: string | undefined,
): NearNetwork => (value === "mainnet" ? "mainnet" : "testnet");

export const APP_RECIPIENT = "sealed.launch";

const API_URL = (
  process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:4001"
).replace(/\/+$/, "");

function hexToBytes(value: string): Uint8Array {
  if (!/^(?:[0-9a-f]{2})+$/i.test(value)) {
    throw new WalletError("failed", "Backend returned an invalid challenge nonce.");
  }

  const bytes = new Uint8Array(value.length / 2);

  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = Number.parseInt(value.slice(i * 2, i * 2 + 2), 16);
  }

  return bytes;
}

function looksCancelled(error: unknown): boolean {
  return /reject|cancel|denied|closed|declin/i.test(
    error instanceof Error ? error.message : String(error),
  );
}

async function postJson<T>(
  path: string,
  body: unknown,
): Promise<T> {
  let response: Response;

  try {
    response = await fetch(`${API_URL}${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
  } catch {
    throw new WalletError(
      "unavailable",
      "Could not reach the authentication server. Check that the backend is running.",
    );
  }

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    const message =
      data?.error?.message ??
      `Authentication request failed (${response.status}).`;

    throw new WalletError(
      "failed",
      typeof message === "string" ? message : "Authentication request failed.",
    );
  }

  return data as T;
}

/**
 * Connect the wallet, request a backend challenge, sign it,
 * and exchange the signature for an authenticated session.
 */
export async function signInWithWallet(
  connector: ConnectorLike,
): Promise<SignedIn> {
  try {
    const wallet = await connector.connect();

    const [account] = await wallet.getAccounts();

    if (!account?.accountId) {
      throw new WalletError(
        "failed",
        "The wallet did not return an account.",
      );
    }

    // Step 1: Ask the backend for a fresh challenge.
    const challengeResponse = await postJson<ChallengeResponse>(
      "/v1/auth/challenge",
      {
        accountId: account.accountId,
      },
    );

    const challenge = challengeResponse.challenge;

    if (
      !challenge ||
      challenge.accountId !== account.accountId ||
      challenge.recipient !== APP_RECIPIENT
    ) {
      throw new WalletError(
        "failed",
        "The backend returned an invalid authentication challenge.",
      );
    }

    // Step 2: Decode the backend-generated nonce.
    const nonceBytes = hexToBytes(challenge.nonce);

    // Step 3: Ask the wallet to sign the exact backend message.
    const signed = await wallet.signMessage({
      message: challenge.message,
      recipient: challenge.recipient,
      nonce: nonceBytes,
    });

    if (!signed.signature || !signed.publicKey) {
      throw new WalletError(
        "failed",
        "The wallet returned no signature.",
      );
    }

    if (signed.accountId !== account.accountId) {
      throw new WalletError(
        "failed",
        "The signing wallet account does not match the connected account.",
      );
    }

    // Step 4: Send the signature to the backend for verification.
    const verifyResponse = await postJson<VerifyResponse>(
      "/v1/auth/verify",
      {
        challengeId: challenge.challengeId,
        accountId: signed.accountId,
        publicKey: signed.publicKey,
        signature: signed.signature,
      },
    );

    const session = verifyResponse.session;

    if (
      !session?.token ||
      session.accountId !== account.accountId
    ) {
      throw new WalletError(
        "failed",
        "The authentication server returned an invalid session.",
      );
    }

    // Step 5: Return the authenticated session to React.
    return {
      accountId: session.accountId,
      publicKey: signed.publicKey,
      signature: signed.signature,
      nonce: challenge.nonce,
      message: challenge.message,
      recipient: challenge.recipient,
      token: session.token,
      expiresAt: session.expiresAt,
    };
  } catch (error) {
    if (error instanceof WalletError) {
      throw error;
    }

    if (looksCancelled(error)) {
      throw new WalletError(
        "cancelled",
        "You closed the wallet before signing in.",
      );
    }

    throw new WalletError(
      "failed",
      error instanceof Error
        ? error.message
        : "The wallet could not complete authentication.",
    );
  }
}

/**
 * Ask the connected wallet to sign agent rules (NEP-413). Returns null-free or throws a WalletError.
 * The backend checks this signature when the launch settles (backend/src/agent-rules.ts).
 */
export async function signAgentRules(connector: ConnectorLike, rules: AgentRules): Promise<{ signature: string; publicKey: string }> {
  try {
    const wallet = connector.wallet ? await connector.wallet() : await connector.connect();
    const signed = await wallet.signMessage({ message: rulesMessage(rules), recipient: AGENT_RECIPIENT, nonce: await rulesNonce(rules) });
    if (!signed.signature || !signed.publicKey) throw new WalletError("failed", "The wallet returned no signature.");
    if (signed.accountId !== rules.owner) throw new WalletError("failed", "The signing wallet account does not match the account the rules are for.");
    return { signature: signed.signature, publicKey: signed.publicKey };
  } catch (error) {
    if (error instanceof WalletError) throw error;
    throw new WalletError(looksCancelled(error) ? "cancelled" : "failed", looksCancelled(error) ? "You closed the wallet without signing." : "The wallet could not sign the rules.");
  }
}
