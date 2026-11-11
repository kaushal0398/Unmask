/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Adds N REAL sealed bids to an open launch through the real API (payment check, sealing in Node with the same
 * seal.ts the browser uses, submit). Sign-in is skipped with a short-lived database session, like settle:demo.
 *   DATABASE_URL=... npx tsx video/flow/addbids.mts <openLaunchId> <count>
 */
import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import { newSalt, sealBid } from "../../src/lib/seal";

const { PrismaClient } = createRequire(import.meta.url)("../../backend/node_modules/@prisma/client");
const prisma = new PrismaClient();
const API = "http://127.0.0.1:4001";
const [launchId, countArg] = process.argv.slice(2);
const count = Number(countArg ?? 1);
const call = async (method: string, path: string, body?: unknown, token?: string) => {
  const res = await fetch(API + path, { method, headers: { ...(body ? { "Content-Type": "application/json" } : {}), ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: body ? JSON.stringify(body) : undefined });
  return { status: res.status, json: (await res.json().catch(() => null)) as any };
};
const key = (await call("GET", `/v1/launches/${launchId}/enclave-key`)).json.key;
for (let i = 0; i < count; i++) {
  const bidder = `buyer-${Date.now().toString(36)}-${i}.testnet`;
  const token = `flow-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
  await prisma.authSession.create({ data: { accountId: bidder, publicKey: "ed25519:dev-shortcut", tokenHash: createHash("sha256").update(token).digest("hex"), expiresAt: new Date(Date.now() + 3_600_000) } });
  const limit = 0.02 + Math.round(Math.random() * 30) / 1000, qty = 50000 + Math.round(Math.random() * 100) * 1000;
  const pc = (await call("POST", `/v1/launches/${launchId}/payment-checks`, { bidder, token: "usdc.test", amountAtomic: String(Math.round(limit * qty * 1e6)) }, token)).json;
  const plain = { launchId, bidder, limit, qty, paymentCheck: { id: pc.check.id, key: pc.claimKey }, salt: await newSalt() };
  const r = await call("POST", `/v1/launches/${launchId}/bids`, await sealBid(plain as never, key), token);
  if (r.status !== 201) { console.error("bid failed", r.status, r.json); process.exit(1); }
}
await prisma.$disconnect();
console.log("added", count, "sealed bids");
