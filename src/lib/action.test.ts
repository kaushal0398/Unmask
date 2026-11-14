import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { bidMessage, createMessage } from "@/lib/action";

// The same literals are asserted in backend/src/action-sig.test.ts. If one side changes, both tests must change together.
describe("wallet approval messages", () => {
  it("builds the exact create-launch text the backend expects", () => {
    assert.equal(
      createMessage({ account: "a.near", name: "Bean", symbol: "bean", supplyAtomic: "1000", reserveAtomic: "5", closesAt: "2026-11-13T11:00:00.000Z", issuedAt: "2026-11-13T09:59:00.000Z" }),
      `Unmask: create a launch
Account: a.near
Token: Bean ($BEAN)
Supply (atomic): 1000
Reserve (atomic): 5
Bidding closes: 2026-11-13T11:00:00.000Z
Issued: 2026-11-13T09:59:00.000Z`,
    );
  });
  it("builds the exact bid text the backend expects, without the bid amount", () => {
    const m = bidMessage({ account: "a.near", launchId: "L1", commitment: "abc", issuedAt: "2026-11-13T09:59:00.000Z" });
    assert.equal(m, `Unmask: place a sealed bid
Account: a.near
Launch: L1
Bid commitment: abc
The bid amount stays sealed.
Issued: 2026-11-13T09:59:00.000Z`);
  });
});
