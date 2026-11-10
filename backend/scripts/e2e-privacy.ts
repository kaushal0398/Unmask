/**
 * Privacy regression test for what the APPLICATION exposes while bidding is open.
 *   DATABASE_URL=... API_URL=http://127.0.0.1:4001 [BACKEND_LOG=/path/to/backend.log] npx tsx scripts/e2e-privacy.ts
 *
 * It seeds an open launch with three sealed bids, then calls every endpoint as an anonymous visitor, as a different
 * signed-in user and as the bid's owner, and checks that nobody gets another user's bid back: not the ciphertext, the
 * commitment, the receipt, the payment check, the amount locked, the limit or quantity, or the account name.
 *
 * It proves the API does not leak. It does NOT prove bids are private from the backend operator: the development enclave
 * holds the key and the database holds the ciphertexts (see docs/PRIVACY_THREAT_MODEL.md). Writes rows: use a throwaway database.
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { PrismaClient } from "@prisma/client";
import sodium from "libsodium-wrappers";
import { commitmentInput, sha256Hex, type PlainBid } from "../src/settlement-core.js";

await sodium.ready;
const prisma = new PrismaClient();
const API = (process.env.API_URL ?? "http://127.0.0.1:4001").replace(/\/+$/, "");
const run = Date.now().toString(36);

const keyRes = await fetch(`${API}/v1/enclave-key`);
const { key } = (await keyRes.json()) as { key: { keyId: string; publicKey: string } };
const publicKey = Uint8Array.from(Buffer.from(key.publicKey, "hex"));
const seal = (p: PlainBid) => sodium.to_base64(sodium.crypto_box_seal(sodium.from_string(JSON.stringify(p)), publicKey), sodium.base64_variants.ORIGINAL);

const creator = `creator-${run}.testnet`;
const launch = await prisma.launch.create({
  data: { name: "Privacy", symbol: "PRV", creator, supplyAtomic: "1000000", reserveAtomic: "10000", tokenDecimals: 0, paymentToken: "usdc.test", paymentDecimals: 6, state: "OPEN", opensAt: new Date(Date.now() - 3600_000), closesAt: new Date(Date.now() + 3600_000) },
});

type Seeded = { who: string; limit: number; qty: number; amount: string; ciphertext: string; commitment: string; receiptId: string; checkId: string };
const seeded: Seeded[] = [];
async function addBid(who: string, limit: number, qty: number, amount: string) {
  const plain: PlainBid = { launchId: launch.id, bidder: who, limit, qty, paymentCheck: { id: "", key: `claim-${who}` }, salt: `salt-${who}-${run}` };
  const check = await prisma.paymentCheck.create({ data: { launchId: launch.id, bidder: who, token: "usdc.test", amountAtomic: amount, state: "LOCKED", expiresAt: new Date(Date.now() + 3600_000) } });
  plain.paymentCheck.id = check.id;
  const ciphertext = seal(plain);
  const commitment = sha256Hex(commitmentInput(plain));
  const receiptId = `rcpt-${who}-${run}`;
  await prisma.bid.create({ data: { launchId: launch.id, bidder: who, ciphertext, commitment, paymentCheckId: check.id, keyId: key.keyId, receiptId } });
  await prisma.launch.update({ where: { id: launch.id }, data: { bidCount: { increment: 1 } } });
  seeded.push({ who, limit, qty, amount, ciphertext, commitment, receiptId, checkId: check.id });
}
// Distinctive numbers so a leak is unmistakable in a response body.
await addBid(`alice-${run}.testnet`, 0.0377, 123457, "11111111111");
await addBid(`bob-${run}.testnet`, 0.0411, 765431, "22222222222");
await addBid(`carol-${run}.testnet`, 0.0522, 987653, "33333333333");
const [alice, bob, carol] = seeded as [Seeded, Seeded, Seeded];

const session = async (accountId: string) => {
  const token = `priv-${run}-${accountId}`;
  await prisma.authSession.create({ data: { accountId, publicKey: "ed25519:test", tokenHash: createHash("sha256").update(token).digest("hex"), expiresAt: new Date(Date.now() + 3600_000) } });
  return token;
};
const aliceToken = await session(alice.who);
const strangerToken = await session(`stranger-${run}.testnet`);

type Reply = { status: number; text: string };
const call = async (path: string, token?: string, method = "GET"): Promise<Reply> => {
  const res = await fetch(API + path, { method, headers: { ...(method === "POST" ? { "Content-Type": "application/json" } : {}), ...(token ? { Authorization: `Bearer ${token}` } : {}) }, ...(method === "POST" ? { body: "{}" } : {}) });
  return { status: res.status, text: await res.text() };
};

/** Everything that identifies one bidder's bid. */
const needles = (b: Seeded) => ({
  ciphertext: b.ciphertext, commitment: b.commitment, receipt: b.receiptId, "payment check id": b.checkId, "amount locked": b.amount,
  limit: String(b.limit), "limit (atomic)": String(Math.round(b.limit * 1e6)), quantity: String(b.qty), account: b.who,
});
const noLeak = (r: Reply, of: Seeded[], where: string) => {
  for (const b of of) for (const [what, n] of Object.entries(needles(b))) assert.ok(!r.text.includes(n), `${where}: leaked ${b.who}'s ${what}`);
};

let checks = 0;
const ok = (cond: unknown, msg: string) => { assert.ok(cond, msg); checks++; };

// ---- 1. an anonymous visitor ------------------------------------------------------------------
const anon: Array<[string, string]> = [
  ["GET /v1/launches", "/v1/launches"], ["GET /v1/launches/:id", `/v1/launches/${launch.id}`], ["GET /v1/launches/:id/result", `/v1/launches/${launch.id}/result`],
  ["GET /v1/launches/:id/enclave-key", `/v1/launches/${launch.id}/enclave-key`], ["GET /v1/enclave-key", "/v1/enclave-key"],
];
for (const [name, path] of anon) { const r = await call(path); noLeak(r, seeded, `anonymous ${name}`); checks++; }
const pub = JSON.parse((await call(`/v1/launches/${launch.id}`)).text) as { launch: Record<string, unknown> };
ok(pub.launch.bidCount === 3, "the bid COUNT is public, by design");
ok(!("bids" in pub.launch), "a launch carries no list of bids");
ok((await call(`/v1/launches/${launch.id}/result`)).status === 404, "no result exists before settling");
const keyBody = (await call("/v1/enclave-key")).text;
ok(/publicKey/.test(keyBody) && !/secret|private|seed/i.test(keyBody), "the enclave key endpoint returns a PUBLIC key only");

// ---- 2. endpoints that need a session refuse an anonymous caller ----------------------------------------
for (const path of ["/v1/me/bids", `/v1/payment-checks/${bob.checkId}`, `/v1/receipts/${bob.receiptId}/verify`]) {
  const r = await call(path); ok(r.status === 401, `anonymous ${path} is refused (got ${r.status})`); noLeak(r, seeded, `anonymous ${path}`);
}
const settleAnon = await call(`/v1/launches/${launch.id}/settle`, undefined, "POST"); ok(settleAnon.status === 401, "settling needs a session"); noLeak(settleAnon, seeded, "anonymous settle");

// ---- 3. a signed-in stranger who bid nothing ---------------------------------------------------------
const mine = await call("/v1/me/bids", strangerToken); ok(mine.status === 200 && JSON.parse(mine.text).bids.length === 0, "a stranger's own bid list is empty"); noLeak(mine, seeded, "stranger /v1/me/bids");
for (const b of seeded) {
  const chk = await call(`/v1/payment-checks/${b.checkId}`, strangerToken); ok(chk.status === 403, `stranger cannot read ${b.who}'s payment check`); noLeak(chk, seeded, `stranger payment check of ${b.who}`);
  const rec = await call(`/v1/receipts/${b.receiptId}/verify`, strangerToken); ok(rec.status === 404, `stranger cannot read ${b.who}'s receipt`); noLeak(rec, seeded, `stranger receipt of ${b.who}`);
}
const ghost = await call("/v1/receipts/does-not-exist/verify", strangerToken);
const real = await call(`/v1/receipts/${bob.receiptId}/verify`, strangerToken);
ok(real.status === ghost.status && real.text === ghost.text, "a receipt that exists but is not yours answers EXACTLY like one that does not exist");
const settleStranger = await call(`/v1/launches/${launch.id}/settle`, strangerToken, "POST"); ok(settleStranger.status === 403, "only the creator can settle"); noLeak(settleStranger, seeded, "stranger settle");

// ---- 4. alice sees her own bid and nobody else's ---------------------------------------------------------
const aliceBids = await call("/v1/me/bids", aliceToken);
ok(aliceBids.status === 200, "alice can list her bids");
noLeak(aliceBids, [bob, carol], "alice /v1/me/bids");
const aliceList = JSON.parse(aliceBids.text).bids as Array<Record<string, unknown>>;
ok(aliceList.length === 1 && aliceList[0]!.commitment === alice.commitment, "alice gets exactly her own bid back");
ok(!aliceBids.text.includes(alice.ciphertext), "even her own ciphertext is not sent back (only a commitment)");
for (const b of [bob, carol]) {
  const chk = await call(`/v1/payment-checks/${b.checkId}`, aliceToken); ok(chk.status === 403, `alice cannot read ${b.who}'s payment check`); noLeak(chk, [bob, carol], `alice -> ${b.who} check`);
  const rec = await call(`/v1/receipts/${b.receiptId}/verify`, aliceToken); ok(rec.status === 404, `alice cannot read ${b.who}'s receipt`); noLeak(rec, [bob, carol], `alice -> ${b.who} receipt`);
}
const ownReceipt = await call(`/v1/receipts/${alice.receiptId}/verify`, aliceToken);
ok(ownReceipt.status === 200 && !ownReceipt.text.includes(alice.ciphertext), "alice's receipt check works and does not return her ciphertext");

// ---- 5. the server's own log -----------------------------------------------------------------------------
let logNote = "not checked (set BACKEND_LOG to scan the server log)";
if (process.env.BACKEND_LOG) {
  const log = readFileSync(process.env.BACKEND_LOG, "utf8");
  // Receipt ids and payment check ids are opaque identifiers that appear in request URLs, so they are in the log by design.
  // What must NOT be there is the content of a bid.
  const identifiers = new Set(["account", "receipt", "payment check id"]);
  for (const b of seeded) for (const [what, n] of Object.entries(needles(b))) { if (identifiers.has(what)) continue; assert.ok(!log.includes(n), `the server log contains ${b.who}'s ${what}`); }
  logNote = `scanned ${log.split("\n").length} log lines: no ciphertext, commitment, amount, limit or quantity (opaque receipt and check ids do appear, in request URLs)`;
  checks++;
}

console.log(`e2e privacy: ${checks} checks passed`);
console.log(`  server log: ${logNote}`);
console.log("  By design the public sees: the bid COUNT, and the launch's rules. Nothing else about any bid.");
await prisma.$disconnect();
