import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { NEAR_USDC_ASSET, ProxyError, createOneClickProxy } from "./oneclick.js";

const NOW = Date.parse("2026-11-09T12:00:00Z");
const good = { dry: true, swapType: "EXACT_OUTPUT", slippageTolerance: 100, originAsset: "nep141:arb-0xaf88d065e77c8cc2239327c5edb3a432268e5831.omft.near", depositType: "ORIGIN_CHAIN", destinationAsset: NEAR_USDC_ASSET, amount: "5000000", refundTo: "0x2527D02599Ba641c19FEa793cD0F167589a0f10D", refundType: "ORIGIN_CHAIN", recipient: "alice.near", recipientType: "DESTINATION_CHAIN", deadline: "2026-11-09T12:30:00.000Z" };
const ok = (body: unknown) => new Response(JSON.stringify(body), { status: 200 });
const rejects = (p: Promise<unknown>, status: number, code: string) => assert.rejects(p, (e) => e instanceof ProxyError && e.status === status && e.code === code, `${status} ${code}`);

describe("1Click proxy", () => {
  it("forwards a valid dry quote, with the API token only on the server side", async () => {
    const seen: Array<{ url: string; init?: RequestInit }> = [];
    const p = createOneClickProxy({ jwt: "secret-jwt", now: () => NOW, fetchImpl: async (url, init) => { seen.push({ url, init }); return ok({ quote: { amountIn: "1" } }); } });
    assert.deepEqual(await p.quote(good), { quote: { amountIn: "1" } });
    assert.equal(seen[0]!.url, "https://1click.chaindefuser.com/v0/quote");
    assert.equal((seen[0]!.init!.headers as Record<string, string>).Authorization, "Bearer secret-jwt");
    assert.equal(JSON.parse(seen[0]!.init!.body as string).dry, true);
  });
  it("refuses live quotes unless the operator allowed them", async () => {
    const calls: string[] = [];
    const off = createOneClickProxy({ now: () => NOW, fetchImpl: async (u) => { calls.push(u); return ok({}); } });
    await rejects(off.quote({ ...good, dry: false }), 403, "live_disabled");
    assert.equal(calls.length, 0, "nothing reached 1Click");
    const on = createOneClickProxy({ allowLive: true, now: () => NOW, fetchImpl: async () => ok({ quote: {} }) });
    await on.quote({ ...good, dry: false });
  });
  it("only ever asks for USDC on NEAR, so it cannot relay arbitrary swaps", async () => {
    const p = createOneClickProxy({ now: () => NOW, fetchImpl: async () => ok({}) });
    await rejects(p.quote({ ...good, destinationAsset: "nep141:wrap.near" }), 400, "bad_request");
    await rejects(p.quote({ ...good, swapType: "EXACT_INPUT" }), 400, "bad_request");
    await rejects(p.quote({ ...good, amount: "0" }), 400, "bad_request");
    await rejects(p.quote({ ...good, amount: "1e9" }), 400, "bad_request");
    await rejects(p.quote({ ...good, originAsset: "not-an-asset" }), 400, "bad_request");
    await rejects(p.quote({ ...good, slippageTolerance: 9000 }), 400, "bad_request");
    await rejects(p.quote("nonsense"), 400, "bad_request");
  });
  it("rejects stale or far-future deadlines", async () => {
    const p = createOneClickProxy({ now: () => NOW, fetchImpl: async () => ok({}) });
    await rejects(p.quote({ ...good, deadline: "2026-11-09T11:00:00.000Z" }), 400, "bad_request");
    await rejects(p.quote({ ...good, deadline: "2026-11-09T18:00:00.000Z" }), 400, "bad_request");
  });
  it("maps upstream failures without leaking auth problems", async () => {
    const down = createOneClickProxy({ now: () => NOW, fetchImpl: async () => { throw new Error("boom"); } });
    await rejects(down.tokens(), 502, "upstream_unreachable");
    const unauthorized = createOneClickProxy({ now: () => NOW, fetchImpl: async () => new Response("{}", { status: 401 }) });
    await rejects(unauthorized.quote(good), 502, "upstream_rejected");
    const bad = createOneClickProxy({ now: () => NOW, fetchImpl: async () => new Response(JSON.stringify({ message: "Amount is too low" }), { status: 400 }) });
    await assert.rejects(bad.quote(good), (e) => e instanceof ProxyError && e.status === 400 && /too low/.test(e.message));
  });
  it("caches the token list for five minutes", async () => {
    let calls = 0, t = NOW;
    const p = createOneClickProxy({ now: () => t, fetchImpl: async () => { calls++; return ok([{ symbol: "USDC" }]); } });
    await p.tokens(); await p.tokens();
    assert.equal(calls, 1);
    t += 6 * 60_000;
    await p.tokens();
    assert.equal(calls, 2);
  });
  it("checks status input", async () => {
    const p = createOneClickProxy({ fetchImpl: async (u) => ok({ url: u }) });
    await rejects(p.status(undefined), 400, "bad_request");
    assert.match(((await p.status("0xabcdef", "7")) as { url: string }).url, /\/v0\/status\?depositAddress=0xabcdef&depositMemo=7$/);
  });
});
