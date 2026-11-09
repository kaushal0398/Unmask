import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { firstCome, sealed } from "@/lib/race";
import { RACE_BIDS, RACE_RESERVE, RACE_SUPPLY } from "@/lib/demo";

describe("the landing page's race", () => {
  const fc = firstCome(RACE_BIDS, RACE_SUPPLY, RACE_RESERVE, 0.06);
  const sb = sealed(RACE_BIDS, RACE_SUPPLY, RACE_RESERVE);

  it("in the first-come launch the bots, who arrive first, take most of the supply and most humans get nothing", () => {
    assert.ok(fc.botShare >= 0.5, `bots ${fc.botShare}`);
    assert.ok(fc.humansServed < fc.humans / 2, `${fc.humansServed} of ${fc.humans} humans served`);
    assert.ok(fc.slices.reduce((a, s) => a + s.share, 0) <= 1.000001);
  });

  it("the bots buy cheaper than the humans who come after them", () => {
    const bot = fc.slices.find((s) => s.kind === "bot")!.avgPrice!;
    const human = fc.slices.find((s) => s.kind === "human")!.avgPrice!;
    assert.ok(bot < human, `bot ${bot} human ${human}`);
  });

  it("in the sealed launch the same bots win nothing, every human who bid at the price is served, and one price is paid", () => {
    assert.equal(sb.botShare, 0);
    assert.ok(sb.humansServed >= 5);
    assert.equal(sb.unsoldShare, 0);
    assert.equal(new Set(sb.slices.filter((s) => s.kind === "human").map((s) => s.avgPrice)).size, 1);
    assert.ok(Math.abs(sb.slices.reduce((a, s) => a + s.share, 0) - 1) < 1e-9);
  });

  it("an agent bidding inside signed rules is served at the one price, not its own limit, while first-come shuts it out", () => {
    const agent = RACE_BIDS.find((b) => b.isAgent)!;
    const slice = sb.slices.find((s) => s.kind === "agent")!;
    assert.ok(slice && slice.share > 0, "the agent gets tokens in the sealed launch");
    assert.equal(slice.avgPrice, sb.finalPrice);
    assert.ok(sb.finalPrice < agent.limit, "it pays less than the limit it bid");
    assert.ok((fc.slices.find((s) => s.kind === "agent")?.share ?? 0) < slice.share, "first-come serves it less");
  });

  it("the humans pay less in the sealed launch than the humans who got in did in the first-come launch", () => {
    const fcHuman = fc.slices.find((s) => s.kind === "human")!.avgPrice!;
    assert.ok(sb.finalPrice < fcHuman);
  });
});
