import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { SETTLE_MS, stageOf } from "@/lib/stage";

describe("stageOf", () => {
  it("keeps a settled launch settled", () => {
    assert.equal(stageOf({ status: "settled", openedAt: 0, now: 5 }).kind, "settled");
  });
  it("walks an open launch through open, settling and settled", () => {
    const base = { status: "open" as const, closesInMs: 10_000, openedAt: 0 };
    assert.equal(stageOf({ ...base, now: 1000 }).kind, "open");
    assert.equal(stageOf({ ...base, now: 10_001 }).kind, "settling");
    assert.equal(stageOf({ ...base, now: 10_000 + SETTLE_MS + 1 }).kind, "settled");
  });
  it("steps through the settling stages in order", () => {
    const s = stageOf({ status: "open", closesInMs: 0, openedAt: 0, now: SETTLE_MS - 1 });
    assert.equal(s.kind, "settling");
    if (s.kind === "settling") assert.equal(s.step, 4);
  });
});
