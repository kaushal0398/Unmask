
import {
  createHash,
  randomBytes,
} from "node:crypto";

import { JsonRpcProvider } from "near-api-js";
import { verifyMessage } from "near-api-js/nep413";

import { prisma } from "./db.js";

const NETWORK = process.env.NEAR_NETWORK ?? "testnet";
const RPC_URL = process.env.NEAR_RPC_URL;

const RECIPIENT = "sealed.launch";

const CHALLENGE_TTL =
  Number(process.env.AUTH_CHALLENGE_TTL_SECONDS ?? 300);

const SESSION_TTL =
  Number(process.env.AUTH_SESSION_TTL_SECONDS ?? 86400);

if (!RPC_URL) {
  throw new Error("NEAR_RPC_URL is required");
}

const provider = new JsonRpcProvider({
  url: RPC_URL,
});

export async function createChallenge(accountId: string) {
  const networkId = await provider.getNetworkId();

  if (networkId !== NETWORK) {
    throw new Error(
      `NEAR network mismatch: expected ${NETWORK}, received ${networkId}`,
    );
  }

  const nonce = randomBytes(32).toString("hex");

  const message =
    `Sign in to Sealed. Challenge: ${nonce}`;

  const expiresAt = new Date(
    Date.now() + CHALLENGE_TTL * 1000,
  );

  const challenge = await prisma.authChallenge.create({
    data: {
      accountId,
      nonce,
      message,
      recipient: RECIPIENT,
      expiresAt,
    },
  });

  return {
    challengeId: challenge.id,
    accountId,
    nonce,
    message,
    recipient: RECIPIENT,
    expiresAt: expiresAt.toISOString(),
  };
}

function decodeSignature(signature: string): Uint8Array {
  const bytes = Buffer.from(signature, "base64");

  if (
    bytes.length !== 64 ||
    bytes.toString("base64") !== signature
  ) {
    throw new Error("Invalid NEAR signature encoding");
  }

  return new Uint8Array(bytes);
}

export async function verifyChallenge(input: {
  challengeId: string;
  accountId: string;
  publicKey: string;
  signature: string;
}) {
  const challenge = await prisma.authChallenge.findUnique({
    where: { id: input.challengeId },
  });

  if (
    !challenge ||
    challenge.accountId !== input.accountId ||
    challenge.consumedAt ||
    challenge.expiresAt <= new Date()
  ) {
    throw new Error("Invalid or expired authentication challenge");
  }

  const signature = decodeSignature(input.signature);

  await verifyMessage({
    signerAccountId: input.accountId,
    signerPublicKey: input.publicKey,
    payload: {
      message: challenge.message,
      recipient: challenge.recipient,
      nonce: new Uint8Array(
        Buffer.from(challenge.nonce, "hex"),
      ),
    },
    signature,
    provider,
  });

  const token = randomBytes(32).toString("base64url");

  const tokenHash = createHash("sha256")
    .update(token)
    .digest("hex");

  const expiresAt = new Date(
    Date.now() + SESSION_TTL * 1000,
  );

  await prisma.$transaction(async (tx) => {
    const consumed = await tx.authChallenge.updateMany({
      where: {
        id: challenge.id,
        consumedAt: null,
        expiresAt: { gt: new Date() },
      },
      data: {
        consumedAt: new Date(),
      },
    });

    if (consumed.count !== 1) {
      throw new Error("Authentication challenge already consumed");
    }

    await tx.authSession.create({
      data: {
        accountId: input.accountId,
        publicKey: input.publicKey,
        tokenHash,
        expiresAt,
      },
    });
  });

  return {
    accountId: input.accountId,
    token,
    expiresAt: expiresAt.toISOString(),
  };
}

export async function getSessionAccount(token: string) {
  if (!token || token.length > 256) {
    return null;
  }

  const tokenHash = createHash("sha256")
    .update(token)
    .digest("hex");

  const session = await prisma.authSession.findUnique({
    where: { tokenHash },
  });

  if (
    !session ||
    session.revokedAt ||
    session.expiresAt <= new Date()
  ) {
    return null;
  }

  return session.accountId;
}