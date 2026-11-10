import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { engineOutputText, rebuildInput, verdictOf, verifyBackendResult, type RawLaunch, type RawResult } from "@/lib/verify-result";
import { sha256Hex } from "@/lib/verify-demo";

/** REAL data: a launch settled by the real backend with the real Rust engine (e2e/fixtures/settled-real.json). */
const real = JSON.parse(readFileSync(new URL("../../e2e/fixtures/settled-real.json", import.meta.url), "utf8")) as { launch: RawLaunch; result: RawResult };
const clone = <T,>(x: T): T => JSON.parse(JSON.stringify(x));
const status = (checks: Awaited<ReturnType<typeof verifyBackendResult>>) => Object.fromEntries(checks.map((c) => [c.id, c.status]));

describe("verifying a real settled launch (real engine output)", () => {
  it("the engine's own recorded hashes are reproduced from the public numbers", async () => {
    const input = rebuildInput(real.launch, real.result.outcome.fills);
    assert.equal(await sha256Hex(JSON.stringify(input)), real.result.inputHash, "input hash");
    assert.equal(await sha256Hex(engineOutputText(real.result.outcome)), real.result.outcome.engineOutputHash, "output hash, rebuilt in the engine's key order");
  });

  it("passes what it can check, and reports the rest as UNCHECKED, never as a pass", async () => {
    const s = status(await verifyBackendResult(real.launch, real.result));
    assert.deepEqual(s, { code: "unchecked", attestation: "unchecked", input: "pass", result: "pass", money: "pass", output: "pass" });
    const verdict = verdictOf(await verifyBackendResult(real.launch, real.result));
    assert.equal(verdict.kind, "partial");
    assert.match(verdict.text, /NOT passes/);
    assert.notEqual(verdict.headline, "This launch was run fairly");
  });
});

describe("catching tampering", () => {
  it("a moved allocation fails the re-run (and the output hash)", async () => {
    const r = clone(real.result);
    const a = r.outcome.fills.find((f) => f.filled !== "0")!, b = r.outcome.fills.find((f) => f.filled === "0")!;
    a.filled = String(BigInt(a.filled) - 50_000n); b.filled = String(BigInt(b.filled) + 50_000n);
    const s = status(await verifyBackendResult(real.launch, r));
    assert.equal(s.result, "fail");
    assert.equal(s.output, "fail");
    assert.equal(verdictOf(await verifyBackendResult(real.launch, r)).kind, "fail");
  });
  it("a dropped bid fails the input hash", async () => {
    const r = clone(real.result);
    r.outcome.fills = r.outcome.fills.filter((f) => f.bidder !== "sniper-a.testnet");
    assert.equal(status(await verifyBackendResult(real.launch, r)).input, "fail");
  });
  it("a changed price fails the re-run and the output hash", async () => {
    const r = clone(real.result);
    r.outcome.clearingPrice = "29999";
    const s = status(await verifyBackendResult(real.launch, r));
    assert.equal(s.result, "fail");
    assert.equal(s.output, "fail");
  });
  it("a wrong output hash fails only the output check", async () => {
    const r = clone(real.result);
    r.outcome.engineOutputHash = "0".repeat(64);
    const s = status(await verifyBackendResult(real.launch, r));
    assert.equal(s.output, "fail");
    assert.equal(s.result, "pass");
  });
  it("a payout plan that does not add up fails the money check", async () => {
    const r = clone(real.result);
    r.outcome.payouts = [...(r.outcome.payouts ?? []), { kind: "refund", amountAtomic: "1" }];
    assert.equal(status(await verifyBackendResult(real.launch, r)).money, "fail");
  });
  it("a different launch config makes the input check fail", async () => {
    assert.equal(status(await verifyBackendResult({ ...real.launch, reserveAtomic: "9999" }, real.result)).input, "fail");
  });
});

describe("other settlement modes", () => {
  it("an OutLayer run leaves the attestation and the output hash unchecked, with advice", async () => {
    const r = clone(real.result);
    r.mode = "outlayer"; r.attestation = "https://testnet-api.outlayer.ai/attestations/by-call/c1"; r.outcome.engineKind = "outlayer";
    const checks = await verifyBackendResult(real.launch, r);
    const s = status(checks);
    assert.equal(s.attestation, "unchecked");
    assert.equal(s.output, "unchecked");
    assert.match(checks.find((c) => c.id === "attestation")!.detail, /outlayer-verify/);
  });
  it("an older settlement with no output hash leaves that check unchecked", async () => {
    const r = clone(real.result);
    delete r.outcome.engineOutputHash;
    assert.equal(status(await verifyBackendResult(real.launch, r)).output, "unchecked");
  });
  it("says 'run fairly' only if nothing at all was unchecked", () => {
    const pass = { id: "x", title: "t", plain: "", status: "pass" as const, detail: "", evidence: [] };
    assert.equal(verdictOf([pass, pass]).kind, "all");
    assert.equal(verdictOf([pass, { ...pass, status: "unchecked" }]).kind, "partial");
    assert.equal(verdictOf([pass, { ...pass, status: "fail" }, { ...pass, status: "unchecked" }]).kind, "fail");
  });
});
