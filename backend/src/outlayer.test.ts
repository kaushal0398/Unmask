import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { runAuction } from "./engine.js";
import { OutLayerError, createOutLayerClient } from "./outlayer.js";

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
const OUTPUT = { version: "1", clearingPrice: "30000", fills: [] };
const client = (fetchImpl: (u: string, i?: RequestInit) => Promise<Response>, extra = {}) =>
  createOutLayerClient({ project: "proofmeme.testnet/snipe-proof-auction", paymentKey: "proofmeme.testnet:1:secret", fetchImpl, pollMs: 1, timeoutMs: 400, ...extra });
const rejects = (p: Promise<unknown>, reason: string) => assert.rejects(p, (e) => e instanceof OutLayerError && e.reason === reason, reason);

describe("OutLayer adapter (stub that follows the published OpenAPI shapes)", () => {
  it("sends the input asynchronously with the payment key, and returns a completed call with its attestation URL", async () => {
    const seen: Array<{ url: string; init?: RequestInit }> = [];
    const c = client(async (url, init) => { seen.push({ url, init }); return json({ call_id: "c1", status: "completed", output: OUTPUT, attestation_url: "https://testnet-api.outlayer.ai/attestations/by-call/c1", compute_cost: "5", instructions: 1234, time_ms: 9 }); });
    const run = await c.run({ version: "1", auctionId: "a" });
    assert.equal(seen[0]!.url, "https://testnet-api.outlayer.ai/call/proofmeme.testnet/snipe-proof-auction");
    assert.equal(seen[0]!.init!.method, "POST");
    assert.equal((seen[0]!.init!.headers as Record<string, string>)["X-Payment-Key"], "proofmeme.testnet:1:secret");
    assert.deepEqual(JSON.parse(seen[0]!.init!.body as string), { input: { version: "1", auctionId: "a" }, async: true });
    assert.equal(run.callId, "c1");
    assert.deepEqual(run.output, OUTPUT);
    assert.equal(run.raw, JSON.stringify(OUTPUT));
    assert.equal(run.attestationUrl, "https://testnet-api.outlayer.ai/attestations/by-call/c1");
    assert.equal(run.instructions, 1234);
  });

  it("pins a version when asked", async () => {
    let body = "";
    await client(async (_u, init) => { body = String(init!.body); return json({ call_id: "c", status: "completed", output: OUTPUT }); }, { versionKey: "f52c7cb0" }).run({});
    assert.equal(JSON.parse(body).version_key, "f52c7cb0");
  });

  it("polls a pending call until it completes, following poll_url", async () => {
    const urls: string[] = [];
    let n = 0;
    const c = client(async (url) => {
      urls.push(url);
      if (url.endsWith("/snipe-proof-auction")) return json({ call_id: "c9", status: "pending", poll_url: "/calls/c9" });
      return ++n < 3 ? json({ call_id: "c9", status: "pending", poll_url: "/calls/c9" }) : json({ call_id: "c9", status: "completed", output: OUTPUT });
    });
    const run = await c.run({});
    assert.equal(run.callId, "c9");
    assert.equal(urls.filter((u) => u.endsWith("/calls/c9")).length, 3);
    assert.equal(urls[1], "https://testnet-api.outlayer.ai/calls/c9");
  });

  it("keeps polling after a 408 (the synchronous window passed) using the poll_url it carries", async () => {
    let first = true;
    const c = client(async () => { if (first) { first = false; return json({ error: "timeout", reason: "timeout", call_id: "c3", poll_url: "/calls/c3" }, 408); } return json({ call_id: "c3", status: "completed", output: OUTPUT }); });
    assert.equal((await c.run({})).callId, "c3");
  });

  it("reports a failed execution with OutLayer's own message", async () => {
    await assert.rejects(client(async () => json({ call_id: "c", status: "failed", error: "wasm_url could not be fetched" })).run({}), (e) => e instanceof OutLayerError && e.reason === "failed" && /could not be fetched/.test(e.message));
  });

  it("turns refusals into advice a person can act on, and never leaks the key", async () => {
    await assert.rejects(client(async () => json({ error: "x", reason: "missing_payment_key" }, 401)).run({}), (e) => e instanceof OutLayerError && /OUTLAYER_PAYMENT_KEY/.test(e.message));
    await assert.rejects(client(async () => json({ error: "x", reason: "out_of_funds" }, 402)).run({}), (e) => e instanceof OutLayerError && /run out of funds/.test(e.message) && !/secret/.test(e.message));
    await rejects(client(async () => json({ error: "nope", reason: "project_not_found" }, 400)).run({}), "project_not_found");
    await assert.rejects(client(async () => json({ error: "Something odd", reason: "brand_new_reason" }, 400)).run({}), (e) => e instanceof OutLayerError && e.message === "Something odd");
  });

  it("gives up cleanly on a call that never finishes, and on a network failure", async () => {
    await rejects(client(async () => json({ call_id: "c", status: "pending", poll_url: "/calls/c" })).run({}), "timeout");
    await rejects(client(async () => { throw new Error("offline"); }).run({}), "network");
  });

  it("rejects a completed call with no output, a missing call id, and a bad project name", async () => {
    await rejects(client(async () => json({ call_id: "c", status: "completed", output: null })).run({}), "no_output");
    await rejects(client(async () => json({ status: "completed", output: OUTPUT })).run({}), "bad_response");
    assert.throws(() => createOutLayerClient({ project: "no-slash", paymentKey: "k" }), (e) => e instanceof OutLayerError && e.reason === "bad_config");
  });
});

describe("engine selection", () => {
  const input = { version: "1" as const, auctionId: "x", supply: "10", reservePrice: "1", tokenDecimals: 0, bids: [] };
  it("refuses to run on OutLayer without its settings, naming each missing one", async () => {
    await assert.rejects(runAuction(input, { AUCTION_ENGINE: "outlayer" } as NodeJS.ProcessEnv), (e) => e instanceof OutLayerError && e.reason === "bad_config" && /OUTLAYER_PROJECT, OUTLAYER_PAYMENT_KEY, OUTLAYER_CODE_HASH/.test(e.message));
    await assert.rejects(runAuction(input, { AUCTION_ENGINE: "outlayer", OUTLAYER_PROJECT: "a/b", OUTLAYER_PAYMENT_KEY: "k" } as NodeJS.ProcessEnv), (e) => e instanceof OutLayerError && /OUTLAYER_CODE_HASH/.test(e.message));
  });
  it("uses the local engine by default and labels the run as a development run", async () => {
    const run = await runAuction(input, {} as NodeJS.ProcessEnv);
    assert.equal(run.mode, "dev");
    assert.ok(run.kind === "native" || run.kind === "wasm");
    assert.equal(run.attestationUrl, null);
    assert.equal(JSON.parse(run.raw).clearingPrice, "1");
  });
});
