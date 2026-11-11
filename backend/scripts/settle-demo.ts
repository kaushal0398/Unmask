/**
 * DEV-ONLY SHORTCUT for the demo: settles a seeded launch as its creator without a wallet.
 *
 *   DATABASE_URL=... API_URL=http://127.0.0.1:4001 npx tsx scripts/settle-demo.ts <launchId>
 *
 * It writes a short-lived session for the launch's creator straight into the database and calls the real
 * POST /v1/launches/:id/settle with it. That is what the Settle button does after a wallet signs in, so the
 * settlement is real; only the sign-in is skipped. Say so when you use it. Refuses to run in production.
 */
import { createHash } from "node:crypto";
import { PrismaClient } from "@prisma/client";

if (process.env.NODE_ENV === "production") { console.error("Refusing to run in production."); process.exit(1); }
const launchId = process.argv[2];
if (!launchId) { console.error("usage: settle-demo.ts <launchId>"); process.exit(1); }

const API = (process.env.API_URL ?? "http://127.0.0.1:4001").replace(/\/+$/, "");
const prisma = new PrismaClient();
const launch = await prisma.launch.findUnique({ where: { id: launchId } });
if (!launch) { console.error(`No launch ${launchId}`); process.exit(1); }

const token = `settle-demo-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
await prisma.authSession.create({ data: { accountId: launch.creator, publicKey: "ed25519:dev-shortcut", tokenHash: createHash("sha256").update(token).digest("hex"), expiresAt: new Date(Date.now() + 10 * 60_000) } });

const res = await fetch(`${API}/v1/launches/${launchId}/settle`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: "{}" });
const body = (await res.json().catch(() => null)) as { result?: { clearingPrice: string; sold: string; totalRaised: string; skippedBids: number; mode: string; attestation: string | null }; alreadySettled?: boolean; error?: { message: string } } | null;
await prisma.$disconnect();
if (!res.ok || !body?.result) { console.error(`Settle failed (${res.status}): ${body?.error?.message ?? "no answer"}`); process.exit(1); }
const r = body.result;
console.log(body.alreadySettled ? "Already settled." : "Settled.");
console.log(`  clearing price $${Number(r.clearingPrice) / 1e6}  ·  sold ${Number(r.sold).toLocaleString("en-US")}  ·  raised $${(Number(r.totalRaised) / 1e6).toLocaleString("en-US")}  ·  ${r.skippedBids} bids left out`);
console.log(`  mode ${r.mode}, attestation ${r.attestation ?? "none"}  (development enclave: reproducible, not attested)`);
console.log(`  Refresh the launch page to see the result.`);
