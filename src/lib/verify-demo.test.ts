import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { getLaunch } from "@/lib/demo";
import { runChecks, sha256Hex } from "@/lib/verify-demo";

describe("the verify page's checks", () => {
  const pup = getLaunch("pixelpup")!;

  it("hashes with real SHA-256", async () => {
    assert.equal(await sha256Hex("abc"), "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
  });

  it("an untouched result passes every check", async () => {
    const checks = await runChecks(pup, { tamper: false });
    assert.deepEqual(checks.map((c) => c.status), ["pass", "pass", "pass", "pass", "pass"]);
  });

  it("a result that hands a bot tokens fails the result and the money checks, and says who and how much", async () => {
    const checks = await runChecks(pup, { tamper: true });
    const by = Object.fromEntries(checks.map((c) => [c.id, c]));
    assert.equal(by.result!.status, "fail");
    assert.equal(by.money!.status, "fail");
    assert.equal(by.code!.status, "pass");
    assert.match(by.result!.detail, /sniper-1\.near/);
    assert.match(by.result!.detail, /50,000|150,000|200,000/);
  });

  it("refuses a launch with no result yet", async () => {
    await assert.rejects(runChecks(getLaunch("moonbean")!, { tamper: false }), /no published result/);
  });
});
