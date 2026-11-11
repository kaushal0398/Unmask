import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { agentViolations, newRules, proposeBid, rulesHash, rulesMessage, type AgentRules } from "@/lib/agent";
import { addressProblem } from "@/lib/intents/addresses";

const read = (f: string) => JSON.parse(readFileSync(new URL(`../../shared/test-vectors/${f}`, import.meta.url), "utf8"));
const vec = read("agent-rules.json");
const addr = read("addresses.json");

describe("agent rules (shared vectors, also run by the backend)", () => {
  for (const c of vec.cases) {
    it(c.name, () => {
      const rules: AgentRules = { ...vec.rules, ...(c.rulesOverride ?? {}) };
      assert.deepEqual(agentViolations(rules, c.bid, new Date(c.atOverride ?? vec.at)), c.expected);
    });
  }
});

describe("address shapes (shared vectors, also run by the backend)", () => {
  for (const c of addr.cases) it(`${c.chain} ${JSON.stringify(c.address).slice(0, 30)}`, () => assert.equal(addressProblem(c.chain, c.address), c.problem));
});

describe("proposeBid", () => {
  const rules: AgentRules = vec.rules;
  const at = new Date(vec.at);
  it("bids its maximum price for as many tokens as the limits allow", () => {
    const p = proposeBid(rules, { reserve: 0.01, supply: 1_000_000, capBps: null, at });
    assert.deepEqual(p, { ok: true, limit: 0.05, qty: 400000 });
  });
  it("respects the spend limit before the quantity limit", () => {
    const p = proposeBid({ ...rules, maxSpend: 1000 }, { reserve: 0.01, supply: 1_000_000, capBps: null, at });
    assert.deepEqual(p, { ok: true, limit: 0.05, qty: 20000 });
  });
  it("respects the per-account cap of the launch", () => {
    const p = proposeBid(rules, { reserve: 0.01, supply: 1_000_000, capBps: 500, at });
    assert.deepEqual(p, { ok: true, limit: 0.05, qty: 50000 });
  });
  it("declines when the maximum price is below the reserve, or the rules expired", () => {
    assert.equal(proposeBid(rules, { reserve: 0.06, supply: 1000, capBps: null, at }).ok, false);
    assert.equal(proposeBid(rules, { reserve: 0.01, supply: 1000, capBps: null, at: new Date("2026-11-11T00:00:00Z") }).ok, false);
  });
  it("never proposes a bid its own rules reject", () => {
    for (const maxSpend of [10, 500, 20000]) for (const capBps of [null, 100, 5000]) {
      const r = { ...rules, maxSpend };
      const p = proposeBid(r, { reserve: 0.01, supply: 1_000_000, capBps, at });
      if (p.ok) assert.deepEqual(agentViolations(r, { launchId: "L1", bidder: "ayush.near", limit: p.limit, qty: p.qty }, at), []);
    }
  });
});

describe("rules hash", () => {
  it("is stable, and changes with any field", async () => {
    const r = newRules({ owner: "a.near", launchId: "L", maxLimitPrice: 0.05, maxQty: 10, maxSpend: 1, minutes: 30, now: new Date("2026-11-10T10:00:00Z"), nonce: "x" });
    assert.equal(await rulesHash(r), await rulesHash({ ...r }));
    assert.notEqual(await rulesHash(r), await rulesHash({ ...r, maxQty: 11 }));
    assert.notEqual(await rulesHash(r), await rulesHash({ ...r, nonce: "y" }));
    assert.match(rulesMessage(r), /^\["unmask-agent-rules",1,"a.near"/);
    assert.equal(r.expiresAt, "2026-11-10T10:30:00.000Z");
  });
});
