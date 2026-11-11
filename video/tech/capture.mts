/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Captures REAL data for the technical video: it makes real calls to the running backend and records what came back.
 *   (backend running, DATABASE_URL / DEV_ENCLAVE_SEED / NEAR_RPC_URL set)   npx tsx video/tech/capture.ts
 * Writes video/tech/data.json. Sign-in is skipped with a short-lived database session (the same shortcut as settle:demo).
 */
import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { newSalt, sealBid, commitmentInput, openBid } from "../../src/lib/seal";
import { verifyBackendResult } from "../../src/lib/verify-result";

const { PrismaClient } = createRequire(import.meta.url)("../../backend/node_modules/@prisma/client");
const prisma = new PrismaClient();
const API = "http://127.0.0.1:4001";
const data: Record<string, unknown> = {};

async function call(method: string, path: string, body?: unknown, token?: string) {
  const res = await fetch(API + path, { method, headers: { ...(body !== undefined ? { "Content-Type": "application/json" } : {}), ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: body !== undefined ? JSON.stringify(body) : undefined });
  const json = await res.json().catch(() => null);
  return { method, path, status: res.status, request: body, response: json };
}
const seed = (args: string[]) => {
  const out = execFileSync("npm", ["run", "seed:demo", "--", "--creator", "demo.testnet", ...args], { cwd: "backend", encoding: "utf8" });
  return out.match(/\/launches\/([a-z0-9]+)/)![1];
};
async function session(accountId: string) {
  const token = `video-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
  await prisma.authSession.create({ data: { accountId, publicKey: "ed25519:dev-shortcut", tokenHash: createHash("sha256").update(token).digest("hex"), expiresAt: new Date(Date.now() + 3_600_000) } });
  return token;
}

const openId = seed(["--open-minutes", "90"]);
const closedId = seed(["--bidder", "demo.testnet"]);
data.openId = openId; data.closedId = closedId;

// 1. sign-in challenge (real; the signature step needs a wallet, so we show the challenge only)
data.challenge = await call("POST", "/v1/auth/challenge", { accountId: "ayush.testnet" });
// 2. the enclave key everyone seals to
const key = await call("GET", `/v1/launches/${openId}/enclave-key`); data.enclaveKey = key;
const enclave = (key.response as { key: { keyId: string; publicKey: string; attestationRef: string } }).key;
const BIDDER = "ayush.testnet"; const token = await session(BIDDER);
const launch = (await call("GET", `/v1/launches/${openId}`)).response as { launch: Record<string, unknown> };
data.launchPublic = launch;

// 3. a payment check, then the bid: limit $0.05, 100,000 tokens => $5,000
const limit = 0.05, qty = 100000, amountAtomic = String(Math.round(limit * qty * 1e6));
const pc = await call("POST", `/v1/launches/${openId}/payment-checks`, { bidder: BIDDER, token: "usdc.test", amountAtomic }, token); data.paymentCheck = pc;
const check = (pc.response as { check: { id: string }; claimKey: string });
const plain = { launchId: openId, bidder: BIDDER, limit, qty, paymentCheck: { id: check.check.id, key: check.claimKey }, salt: await newSalt() };
const sealed = await sealBid(plain as never, enclave);
data.plaintext = plain; data.commitmentInput = commitmentInput(plain as never); data.sealed = sealed;
data.submit = await call("POST", `/v1/launches/${openId}/bids`, sealed, token);

// 4. rejections, real
const pc2 = await call("POST", `/v1/launches/${openId}/payment-checks`, { bidder: BIDDER, token: "usdc.test", amountAtomic }, token);
const check2 = pc2.response as { check: { id: string } };
const EVE = "eve.testnet"; const eveToken = await session(EVE);
const pcEve = (await call("POST", `/v1/launches/${openId}/payment-checks`, { bidder: EVE, token: "usdc.test", amountAtomic }, eveToken)).response as { check: { id: string } };
data.rejectPlaintext = await call("POST", `/v1/launches/${openId}/bids`, { launchId: openId, bidder: EVE, keyId: enclave.keyId, commitment: sealed.commitment, ciphertext: JSON.stringify({ ...plain, bidder: EVE }), paymentCheckId: pcEve.check.id }, eveToken);
data.rejectDuplicate = await call("POST", `/v1/launches/${openId}/bids`, { ...sealed, paymentCheckId: check2.check.id }, token);
data.rejectNoAuth = await call("POST", `/v1/launches/${openId}/bids`, sealed);
const closedKey = (await call("GET", `/v1/launches/${closedId}/enclave-key`)).response as { key: typeof enclave };
const pcClosed = await call("POST", `/v1/launches/${closedId}/payment-checks`, { bidder: BIDDER, token: "usdc.test", amountAtomic }, token);
data.rejectClosed = pcClosed;

// 5. what is public, and what the database holds
data.myBids = await call("GET", "/v1/me/bids", undefined, token);
const row = await prisma.bid.findFirst({ where: { launchId: openId, bidder: BIDDER } });
data.dbRow = row && { id: row.id, launchId: row.launchId, bidder: row.bidder, ciphertext: row.ciphertext, commitment: row.commitment, paymentCheckId: row.paymentCheckId, keyId: row.keyId, receiptId: row.receiptId };
data.publicAfter = (await call("GET", `/v1/launches/${openId}`)).response;

// 6. the dev enclave opens the bid (this is why the backend operator can read bids today)
const { openBid: devOpen } = await import("../../backend/src/dev-enclave");
data.devEnclaveOpens = devOpen(sealed.ciphertext);
void openBid; void closedKey;

// 7. settle the closed launch with the real route, then read what is public
const creatorToken = await session("demo.testnet");
data.settle = await call("POST", `/v1/launches/${closedId}/settle`, {}, creatorToken);
const result = (await call("GET", `/v1/launches/${closedId}/result`)).response as { result: Record<string, any> };
data.result = result;
const closedLaunch = (await call("GET", `/v1/launches/${closedId}`)).response as { launch: Record<string, any> };
data.closedLaunch = closedLaunch;
data.verify = await verifyBackendResult(closedLaunch.launch as never, result.result as never);

// 8. NEAR Intents dry quote
data.quote = await call("POST", "/v1/intents/quote", { dry: true, swapType: "EXACT_OUTPUT", slippageTolerance: 100, originAsset: "nep141:arb-0xaf88d065e77c8cc2239327c5edb3a432268e5831.omft.near", depositType: "ORIGIN_CHAIN", destinationAsset: "nep141:17208628f84f5d6ad33f0da3bbbeb27ffcb398eac501a31bd6ad2011e36133a1", amount: "5000000", refundTo: "0x2527D02599Ba641c19FEa793cD0F167589a0f10D", refundType: "ORIGIN_CHAIN", recipient: "intents.near", recipientType: "DESTINATION_CHAIN", deadline: new Date(Date.now() + 1_800_000).toISOString() });

writeFileSync("video/tech/data.json", JSON.stringify(data, null, 1));
await prisma.$disconnect();
console.log("captured", Object.keys(data).length, "items; submit", (data.submit as { status: number }).status, "settle", (data.settle as { status: number }).status);
