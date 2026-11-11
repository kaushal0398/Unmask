#!/usr/bin/env node
// Checks that the demo is ready to show. Read-only: it never writes, seeds or settles anything.
//   node scripts/demo-preflight.mjs [--api http://127.0.0.1:4001] [--web http://localhost:3000] [--offline]
// --offline skips the checks that need the internet (the live NEAR Intents quote).
// Exit code 1 if anything FAILs. A WARN does not fail but should be read.
import { statfsSync } from "node:fs";

const arg = (name, fallback) => { const i = process.argv.indexOf(`--${name}`); return i > -1 ? process.argv[i + 1] : fallback; };
const API = arg("api", process.env.API_URL ?? "http://127.0.0.1:4001").replace(/\/+$/, "");
const WEB = arg("web", process.env.WEB_URL ?? "http://localhost:3000").replace(/\/+$/, "");
const offline = process.argv.includes("--offline");

const rows = [];
const add = (status, name, detail = "") => rows.push({ status, name, detail });
const get = async (url, init) => {
  try {
    const res = await fetch(url, { ...init, signal: AbortSignal.timeout(20_000) });
    const text = await res.text();
    let json = null;
    try { json = JSON.parse(text); } catch { /* not JSON */ }
    return { ok: res.ok, status: res.status, json, headers: res.headers };
  } catch (e) {
    return { ok: false, status: 0, json: null, error: e instanceof Error ? e.message : String(e), headers: new Headers() };
  }
};

// 1. backend
const health = await get(`${API}/health`);
if (health.ok && health.json?.ok) add("PASS", "Backend is up", `${API}  mode=${health.json.mode}`);
else add("FAIL", "Backend is up", health.error ? `${API} unreachable. Start it: cd backend && npm run dev` : `${API} answered ${health.status}`);
if (health.ok && health.json?.mode === "production") add("FAIL", "Backend is in development mode", "NODE_ENV=production makes settlement refuse to run. Unset it for the demo");

// 2. enclave key (seeding and bidding both need it)
const key = await get(`${API}/v1/enclave-key`);
if (key.ok && /^[0-9a-f]{64}$/.test(key.json?.key?.publicKey ?? "")) add("PASS", "Enclave public key is served", `keyId ${key.json.key.keyId}`);
else add("FAIL", "Enclave public key is served", `GET /v1/enclave-key answered ${key.status || key.error}`);

// 3. web app
for (const [path, label] of [["/", "Web app home"], ["/verify", "Verify page"], ["/launches", "Launches page"]]) {
  const r = await get(`${WEB}${path}`);
  if (r.ok) add("PASS", `${label} loads`, `${WEB}${path}`);
  else add("FAIL", `${label} loads`, r.error ? `${WEB} unreachable. Start it: npx next build && npx next start -p 3000` : `answered ${r.status}`);
}

// 4. CORS: the browser at WEB must be allowed to call the backend
const cors = await get(`${API}/v1/launches`, { method: "OPTIONS", headers: { Origin: new URL(WEB).origin, "Access-Control-Request-Method": "GET" } });
const allowed = cors.headers.get("access-control-allow-origin");
if (allowed === new URL(WEB).origin) add("PASS", "Backend allows the web app's origin (CORS)", allowed);
else if (health.ok) add("FAIL", "Backend allows the web app's origin (CORS)", `${new URL(WEB).origin} is not allowed. Set CORS_ORIGINS on the backend`);

// 5. funding preview (needs the internet)
if (offline) add("SKIP", "Live NEAR Intents price preview", "--offline");
else {
  const tokens = await get(`${API}/v1/intents/tokens`);
  if (!(tokens.ok && Array.isArray(tokens.json) && tokens.json.length > 0)) add("FAIL", "NEAR Intents token list", `answered ${tokens.status || tokens.error}. Is the internet up?`);
  else {
    add("PASS", "NEAR Intents token list", `${tokens.json.length} tokens`);
    const body = { dry: true, swapType: "EXACT_OUTPUT", slippageTolerance: 100, originAsset: "nep141:arb-0xaf88d065e77c8cc2239327c5edb3a432268e5831.omft.near", depositType: "ORIGIN_CHAIN", destinationAsset: "nep141:17208628f84f5d6ad33f0da3bbbeb27ffcb398eac501a31bd6ad2011e36133a1", amount: "5000000", refundTo: "0x2527D02599Ba641c19FEa793cD0F167589a0f10D", refundType: "ORIGIN_CHAIN", recipient: "intents.near", recipientType: "DESTINATION_CHAIN", deadline: new Date(Date.now() + 30 * 60_000).toISOString() };
    const q = await get(`${API}/v1/intents/quote`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    if (q.ok && q.json?.quote?.amountIn && !q.json.quote.depositAddress) add("PASS", "Live price preview works, with no deposit address", `pay ${q.json.quote.amountInFormatted} USDC on Arbitrum for 5 USDC on NEAR`);
    else add("FAIL", "Live price preview works", `answered ${q.status}: ${q.json?.error?.message ?? q.error ?? "no quote"}`);
    const live = await get(`${API}/v1/intents/quote`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...body, dry: false }) });
    if (live.status === 403 && live.json?.error?.code === "live_disabled") add("PASS", "Live deposits are refused (safe)", "live_disabled");
    else add("FAIL", "Live deposits are refused (safe)", `answered ${live.status}. Unset ONECLICK_ALLOW_LIVE: a demo must not take deposits`);
  }
}

// 6. demo launches
const list = await get(`${API}/v1/launches`);
if (list.ok && Array.isArray(list.json?.launches)) {
  const demo = list.json.launches.filter((l) => l.symbol === "DEMO");
  const now = Date.now();
  const open = demo.filter((l) => l.status === "open" && l.closesAt && Date.parse(l.closesAt) > now);
  const closed = demo.filter((l) => l.status === "open" && l.closesAt && Date.parse(l.closesAt) <= now);
  const settled = demo.filter((l) => l.status === "settled");
  const longest = open.sort((a, b) => Date.parse(b.closesAt) - Date.parse(a.closesAt))[0];
  if (!longest) add("FAIL", "An OPEN demo launch exists", "none. Seed one: cd backend && npm run seed:demo -- --creator YOU.testnet --open-minutes 60");
  else {
    const mins = Math.floor((Date.parse(longest.closesAt) - now) / 60_000);
    add(mins >= 20 ? "PASS" : "WARN", "An OPEN demo launch exists", `${WEB}/launches/${longest.id}  closes in ${mins} min${mins < 20 ? ". Seed a fresh one before recording" : ""}`);
  }
  if (closed.length) add("PASS", "A CLOSED demo launch is ready to settle", `${WEB}/launches/${closed[0].id}`);
  else if (settled.length) add("WARN", "A CLOSED demo launch is ready to settle", `only already-settled ones exist (${WEB}/launches/${settled[0].id}). Seed a fresh closed one to show settling`);
  else add("FAIL", "A CLOSED demo launch is ready to settle", "none. Seed one: cd backend && npm run seed:demo -- --creator YOU.testnet --bidder YOU.testnet");
} else add("FAIL", "Demo launches can be listed", `GET /v1/launches answered ${list.status || list.error}`);

// 7. disk space (a full disk broke Docker on 10 Nov)
try {
  const s = statfsSync("/");
  const freeGb = (s.bavail * s.bsize) / 1024 ** 3;
  add(freeGb >= 2 ? "PASS" : freeGb >= 0.5 ? "WARN" : "FAIL", "Free disk space", `${freeGb.toFixed(1)} GB${freeGb < 2 ? ". Low: builds and databases can fail" : ""}`);
} catch { add("SKIP", "Free disk space", "not available on this system"); }

// report
const icon = { PASS: "PASS", FAIL: "FAIL", WARN: "WARN", SKIP: "SKIP" };
const width = Math.max(...rows.map((r) => r.name.length));
console.log(`\nDemo preflight  (api ${API}, web ${WEB})\n`);
for (const r of rows) console.log(`  ${icon[r.status]}  ${r.name.padEnd(width)}  ${r.detail}`);
const count = (s) => rows.filter((r) => r.status === s).length;
console.log(`\n${count("PASS")} passed, ${count("WARN")} warnings, ${count("FAIL")} failed, ${count("SKIP")} skipped`);
console.log("Not checked here: wallet sign-in with a real wallet (see DEMO_GUIDE.md, Plan A), and the Settle button.\n");
process.exit(count("FAIL") ? 1 : 0);
