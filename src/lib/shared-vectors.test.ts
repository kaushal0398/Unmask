import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { clearAuctionExact } from "@/lib/auction-core";

/** The same file the Rust engine is tested against (enclave/auction-engine/tests). */
const doc = JSON.parse(readFileSync(new URL("../../shared/test-vectors/auction-v1-cases.json", import.meta.url), "utf8"));
const first = JSON.parse(readFileSync(new URL("../../shared/test-vectors/auction-v1.json", import.meta.url), "utf8"));

describe("shared auction test vectors", () => {
  it("has the full case list", () => assert.ok(doc.cases.length >= 10));
  for (const c of doc.cases) {
    it(`TypeScript reproduces: ${c.name}`, () => assert.deepEqual(clearAuctionExact(c.input), c.expected));
  }
  it("TypeScript reproduces the original worked example", () => assert.deepEqual(clearAuctionExact(first.input), first.expected));
});
