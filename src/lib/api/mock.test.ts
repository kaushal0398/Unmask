import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { MockLaunchApi } from "@/lib/api/mock";
import { ApiError, CreateStepError, type SealedBid } from "@/lib/api/types";
import { newSalt, sealBid } from "@/lib/seal";

const setup = () => {
  let t = 1_000_000;
  const api = new MockLaunchApi({ now: () => t, latencyMs: 0 });
  return { api, advance: (ms: number) => (t += ms) };
};

async function bidFor(api: MockLaunchApi, launchId = "moonbean", bidder = "me.near") {
  const { check, key } = await api.createPaymentCheck({ launchId, amount: 500 });
  const bid: SealedBid = await sealBid(
    { launchId, bidder, limit: 0.02, qty: 10_000, salt: await newSalt(), paymentCheck: { id: check.id, key } },
    await api.getEnclaveKey(launchId),
  );
  return { bid, check };
}

describe("MockLaunchApi", () => {
  it("lists launches and opens one up", async () => {
    const { api } = setup();
    assert.ok((await api.listLaunches()).length >= 3);
    assert.equal((await api.getLaunch("moonbean"))?.status, "open");
    assert.equal(await api.getLaunch("nope"), null);
  });

  it("closes, settles and reveals a result as the clock moves", async () => {
    const { api, advance } = setup();
    assert.equal(await api.getResult("moonbean"), null);
    advance(10 * 3_600_000);
    assert.equal((await api.getLaunch("moonbean"))?.status, "settled");
    const r = await api.getResult("moonbean");
    assert.ok(r && r.clearingPrice > 0 && r.attestation.kind === "tdx");
  });

  it("takes a sealed bid and refuses a double bid", async () => {
    const { api } = setup();
    const { bid } = await bidFor(api);
    assert.match((await api.submitBid(bid)).receiptId, /^rcpt_/);
    await assert.rejects(api.submitBid(bid), (e) => e instanceof ApiError && e.code === "bid_rejected");
  });

  it("refuses a plaintext bid", async () => {
    const { api } = setup();
    const { bid } = await bidFor(api);
    const plain = Buffer.from(JSON.stringify({ limit: 1 })).toString("base64");
    await assert.rejects(api.submitBid({ ...bid, ciphertext: plain }), (e) => e instanceof ApiError && e.code === "bid_rejected");
  });

  it("refuses a bid after close", async () => {
    const { api, advance } = setup();
    const { bid } = await bidFor(api);
    advance(10 * 3_600_000);
    await assert.rejects(api.submitBid(bid), (e) => e instanceof ApiError && e.code === "closed");
  });

  it("fails a payment check on demand, then recovers", async () => {
    const { api } = setup();
    api.failNextPayment();
    await assert.rejects(api.createPaymentCheck({ launchId: "moonbean", amount: 5 }), (e) => e instanceof ApiError && e.code === "payment_failed");
    assert.equal((await api.createPaymentCheck({ launchId: "moonbean", amount: 5 })).check.state, "locked");
  });

  it("reclaims a check, including an expired one, but not twice", async () => {
    const { api } = setup();
    const { check } = await api.createPaymentCheck({ launchId: "moonbean", amount: 5 });
    api.expireCheck(check.id);
    assert.equal((await api.getPaymentCheck(check.id))?.state, "expired");
    assert.equal((await api.reclaimPaymentCheck(check.id)).state, "reclaimed");
    await assert.rejects(api.reclaimPaymentCheck(check.id));
  });

  it("withdraws a bid, reclaiming its check, and lets the buyer bid again", async () => {
    const { api } = setup();
    const { bid, check } = await bidFor(api);
    await api.submitBid(bid);
    await api.withdrawBid("moonbean", "me.near");
    assert.equal((await api.getPaymentCheck(check.id))?.state, "reclaimed");
    const again = await bidFor(api);
    await api.submitBid(again.bid);
  });

  it("creates a launch in five steps", async () => {
    const { api } = setup();
    const seen: number[] = [];
    const { id } = await api.createLaunch(
      { name: "Test Coin", symbol: "TST", supply: 1000, reserve: 0.01, capPercent: 0, windowMinutes: 30, unsold: "return" as const },
      (s) => seen.push(s.filter((x) => x.state === "done").length),
    );
    assert.equal(seen.at(-1), 5);
    assert.equal((await api.getLaunch(id))?.status, "open");
  });

  it("stops at a failed step and resumes from it", async () => {
    const { api } = setup();
    const input = { name: "Test Coin", symbol: "TST", supply: 1000, reserve: 0.01, capPercent: 0, windowMinutes: 30, unsold: "return" as const };
    api.failNextCreateAt("mint-supply");
    await assert.rejects(api.createLaunch(input, () => {}), (e) => e instanceof CreateStepError && e.step === "mint-supply");
    const { id } = await api.createLaunch(input, () => {}, { resumeFrom: "mint-supply" });
    assert.ok(await api.getLaunch(id));
  });

  it("lists the buyer's positions including a new bid", async () => {
    const { api } = setup();
    const { bid } = await bidFor(api);
    await api.submitBid(bid);
    const p = await api.positions();
    assert.ok(p.some((x) => x.paymentCheckId === bid.paymentCheckId));
  });
});
