/**
 * Seeds a launch for the live demo: sealed bids from honest buyers, one agent inside its rules, one cross-chain
 * refund, four snipers who bid low, and a few bids that will be rejected (so "Bids left out" has something to show).
 * The launch is CLOSED, so the creator can press Settle straight away.
 *
 *   DATABASE_URL=... API_URL=http://127.0.0.1:4001 npx tsx scripts/seed-demo.ts --creator you.testnet [--bidder you.testnet] [--open-minutes 0]
 *
 * --creator   the NEAR account you will sign in with. Only this account sees the Settle button.
 * --bidder    optional: your account also gets a bid, so you see "Your result" (the result card) after settling.
 * --open-minutes  N > 0 leaves the window open for N minutes instead (to show the countdown and the bid form).
 *
 * The backend must be running with the SAME DEV_ENCLAVE_SEED it will use to settle: bids are sealed to its key.
 * The payment checks are database rows (the payment provider is a stand-in): no funds exist.
 */
import { PrismaClient } from "@prisma/client";
import sodium from "libsodium-wrappers";
import { rulesHash, type AgentRules } from "../src/agent-rules.js";
import { commitmentInput, sha256Hex, type PlainBid } from "../src/settlement-core.js";

await sodium.ready;
const arg = (name: string) => { const i = process.argv.indexOf(`--${name}`); return i > -1 ? process.argv[i + 1] : undefined; };
const creator = arg("creator");
const bidderMe = arg("bidder");
const openMinutes = Number(arg("open-minutes") ?? 0);
if (!creator) { console.error("usage: seed-demo.ts --creator <account> [--bidder <account>] [--open-minutes N]"); process.exit(1); }

const API = (process.env.API_URL ?? "http://127.0.0.1:4001").replace(/\/+$/, "");
const WEB = (process.env.WEB_URL ?? "http://localhost:3000").replace(/\/+$/, "");
const prisma = new PrismaClient();
const run = Date.now().toString(36);

const keyRes = await fetch(`${API}/v1/enclave-key`).catch(() => null);
if (!keyRes?.ok) { console.error(`Could not reach the backend at ${API}. Start it first.`); process.exit(1); }
const { key } = (await keyRes.json()) as { key: { keyId: string; publicKey: string } };
const publicKey = Uint8Array.from(Buffer.from(key.publicKey, "hex"));
const seal = (p: PlainBid) => sodium.to_base64(sodium.crypto_box_seal(sodium.from_string(JSON.stringify(p)), publicKey), sodium.base64_variants.ORIGINAL);

const closed = openMinutes <= 0;
const launch = await prisma.launch.create({
  data: {
    name: "DemoCoin", symbol: "DEMO", creator, emoji: "🎭", hue: 320, tagline: "Bid blind. Pay one price.",
    supplyAtomic: "1000000", reserveAtomic: "10000", tokenDecimals: 0, paymentToken: "usdc.test", paymentDecimals: 6,
    state: "OPEN",
    opensAt: new Date(Date.now() - 2 * 3600_000),
    closesAt: new Date(Date.now() + (closed ? -60_000 : openMinutes * 60_000)),
  },
});

let n = 0;
async function bid(who: string, limit: number, qty: number, extra: Partial<PlainBid> = {}) {
  n++;
  const plain: PlainBid = { launchId: launch.id, bidder: who, limit, qty, paymentCheck: { id: "", key: `claim-${run}-${n}` }, salt: `salt-${run}-${n}`, ...extra };
  const check = await prisma.paymentCheck.create({ data: { launchId: launch.id, bidder: who, token: "usdc.test", amountAtomic: "999999999999", state: "LOCKED", expiresAt: new Date(Date.now() + 6 * 3600_000) } });
  plain.paymentCheck.id = check.id;
  await prisma.bid.create({ data: { launchId: launch.id, bidder: who, ciphertext: seal(plain), commitment: sha256Hex(commitmentInput(plain)), paymentCheckId: check.id, keyId: key.keyId, receiptId: `demo-${run}-${n}` } });
  await prisma.launch.update({ where: { id: launch.id }, data: { bidCount: { increment: 1 } } });
}

const ARB = "0x2527D02599Ba641c19FEa793cD0F167589a0f10D";
const agentRules = (owner: string): AgentRules => ({ version: 1, owner, launchId: launch.id, maxLimitPrice: 0.05, maxQty: 50000, maxSpend: 2500, expiresAt: new Date(Date.now() + 24 * 3600_000).toISOString(), nonce: `demo-${run}` });
const claim = (owner: string) => ({ rules: agentRules(owner), rulesHash: rulesHash(agentRules(owner)) });

// The honest buyers: the README example. With --bidder you take the place of "b".
await bid("ana.testnet", 0.05, 400_000);
await bid(bidderMe ?? "ben.testnet", 0.04, 300_000);
await bid("chi.testnet", 0.03, 300_000);
// priced out, so the whole refund is sent: to an Arbitrum address, through NEAR Intents
await bid("dev.testnet", 0.02, 200_000, { payout: { refundTo: { chain: "arb", address: ARB } } });
// An agent bidding inside the rules its owner set (unsigned here: no wallet signed it).
await bid("agent-owner.testnet", 0.02, 50_000, { agent: claim("agent-owner.testnet") });
// Four snipers who bid low hoping for a cheap start: priced out and refunded.
for (const s of ["a", "b", "c", "d"]) await bid(`sniper-${s}.testnet`, 0.015, 150_000);
// Bids that will be left out, with a reason: an agent that breaks its rules, and a bad refund address.
await bid("rogue-agent.testnet", 0.08, 100, { agent: claim("rogue-agent.testnet") });
await bid("typo.testnet", 0.02, 100, { payout: { refundTo: { chain: "arb", address: "0x123" } } });

console.log(`\nSeeded ${closed ? "a CLOSED" : `an OPEN (${openMinutes} min)`} launch with ${n} sealed bids.\n`);
console.log(`  Launch page : ${WEB}/launches/${launch.id}`);
console.log(`  Creator     : ${creator}  (sign in with this account to see the Settle button)`);
if (bidderMe) console.log(`  Your bid    : ${bidderMe} bid $0.04 for 300,000 DEMO, so you will get "Your result" after settling`);
console.log(`  Expect      : clearing price $0.03, 1,000,000 sold, $30,000 raised, 2 bids left out, 1 agent bid, 1 cross-chain refund\n`);
await prisma.$disconnect();
