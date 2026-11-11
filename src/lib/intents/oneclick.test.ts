import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { IntentsClient, IntentsError, NEAR_USDC_ASSET, dollarsToAtomic, fundingOrigins, fundingRequest, summarizeQuote, type OneClickToken, type QuoteResponse } from "@/lib/intents/oneclick";

const real: QuoteResponse = JSON.parse(readFileSync(new URL("./fixtures/quote-dry.json", import.meta.url), "utf8"));
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

describe("fundingRequest", () => {
  it("asks for an exact USDC amount on NEAR, refunded to the origin chain, as a dry run by default", () => {
    const r = fundingRequest({ originAsset: "nep141:arb-0xaf88d065e77c8cc2239327c5edb3a432268e5831.omft.near", amountUsd: 5, refundTo: "0x2527D02599Ba641c19FEa793cD0F167589a0f10D", recipient: "alice.near", now: new Date("2026-11-09T12:00:00Z") });
    assert.equal(r.dry, true);
    assert.equal(r.swapType, "EXACT_OUTPUT");
    assert.equal(r.destinationAsset, NEAR_USDC_ASSET);
    assert.equal(r.amount, "5000000");
    assert.equal(r.refundType, "ORIGIN_CHAIN");
    assert.equal(r.recipientType, "DESTINATION_CHAIN");
    assert.equal(r.deadline, "2026-11-09T12:30:00.000Z");
  });
  it("matches the request the live service accepted (fixture)", () => {
    const sent = fundingRequest({ originAsset: real.quoteRequest.originAsset, amountUsd: 5, refundTo: real.quoteRequest.refundTo, recipient: "alice.near" });
    for (const k of ["dry", "swapType", "slippageTolerance", "originAsset", "depositType", "destinationAsset", "amount", "refundTo", "refundType", "recipient", "recipientType"] as const) {
      assert.deepEqual(sent[k], real.quoteRequest[k], k);
    }
  });
  it("rounds the amount UP so a bid is never under-funded", () => {
    assert.equal(dollarsToAtomic(0.0000011), "2");
    assert.equal(dollarsToAtomic(12.345678), "12345678");
    assert.equal(dollarsToAtomic(0.1 + 0.2), "300000");
  });
});

describe("summarizeQuote on a real response", () => {
  it("reads amounts, cost and time", () => {
    const s = summarizeQuote(real, { symbol: "USDC", decimals: 6 });
    assert.equal(s.pay, "5.051108 USDC");
    assert.equal(s.receive, "5.0 USDC on NEAR");
    assert.equal(s.minPay, "5.000596 USDC");
    assert.equal(s.etaSeconds, 25);
    assert.equal(s.live, false, "a dry quote has no deposit address");
    assert.ok(s.costUsd !== null && s.costUsd > 0.05 && s.costUsd < 0.06, String(s.costUsd));
  });
});

describe("IntentsClient", () => {
  it("calls the proxy paths and sends the quote body", async () => {
    const calls: Array<{ url: string; init?: RequestInit }> = [];
    const c = new IntentsClient("http://api/v1/intents/", async (url, init) => { calls.push({ url, init }); return json(real); });
    const out = await c.quote(fundingRequest({ originAsset: "x", amountUsd: 1, refundTo: "r", recipient: "alice.near" }));
    assert.equal(calls[0]!.url, "http://api/v1/intents/quote");
    assert.equal(calls[0]!.init?.method, "POST");
    assert.equal(out.quote.amountIn, "5051108");
    await new IntentsClient("http://api/v1/intents", async (url) => { calls.push({ url }); return json({ status: "PENDING_DEPOSIT" }); }).status("0xabc", "9");
    assert.equal(calls[1]!.url, "http://api/v1/intents/status?depositAddress=0xabc&depositMemo=9");
  });
  it("turns failures into typed errors", async () => {
    await assert.rejects(new IntentsClient("http://api", async () => { throw new Error("down"); }).tokens(), (e) => e instanceof IntentsError && e.kind === "network");
    await assert.rejects(new IntentsClient("http://api", async () => json({ message: "bad address" }, 400)).tokens(), (e) => e instanceof IntentsError && e.kind === "rejected" && /bad address/.test(e.message));
    await assert.rejects(new IntentsClient("http://api", async () => json({ error: { code: "live_disabled", message: "Live quotes are off." } }, 403)).tokens(), (e) => e instanceof IntentsError && e.kind === "disabled");
    await assert.rejects(new IntentsClient("http://api", async () => json({ quote: {} })).quote(fundingRequest({ originAsset: "x", amountUsd: 1, refundTo: "r", recipient: "a.near" })), (e) => e instanceof IntentsError && e.kind === "bad_response");
  });
});

describe("fundingOrigins", () => {
  it("keeps stablecoins and native coins on checkable chains, and drops the destination asset", () => {
    const t = (blockchain: string, symbol: string, assetId = `${blockchain}-${symbol}`): OneClickToken => ({ assetId, blockchain, symbol, decimals: 6 });
    const out = fundingOrigins([t("arb", "USDC"), t("sol", "SOL"), t("doge", "DOGE"), t("eth", "SHIB"), t("near", "USDC", NEAR_USDC_ASSET), t("base", "USDT")]);
    assert.deepEqual(out.map((x) => `${x.blockchain}:${x.symbol}`), ["arb:USDC", "base:USDT", "sol:SOL"]);
  });
});
