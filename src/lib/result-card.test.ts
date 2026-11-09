import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { Result } from "@/lib/api/types";
import { cardFor, cardSvg, cardText } from "@/lib/result-card";

const result = (over: Partial<Result> = {}): Result => ({
  launchId: "L1", clearingPrice: 0.03, sold: 1_000_000, unsold: 0, raised: 30_000, totalBids: 6,
  allocations: [
    { bidder: "a.near", limit: 0.05, qty: 400_000, filled: 400_000, paid: 12_000, refund: 8_000 },
    { bidder: "b.near", limit: 0.04, qty: 300_000, filled: 150_000, paid: 4_500, refund: 7_500, agent: { signed: true } },
    { bidder: "d.near", limit: 0.02, qty: 200_000, filled: 0, paid: 0, refund: 4_000 },
  ],
  codeHash: "c".repeat(64), inputHash: "i".repeat(64),
  attestation: { kind: "dev", quote: "", codeHash: "c", inputHash: "i", resultHash: "r".repeat(64), signer: "dev-enclave" },
  settledAt: "2026-11-10T00:00:00Z", mode: "dev", ...over,
});

describe("cardFor", () => {
  it("shows paid, refunded, effective price and what the clearing price saved", () => {
    const c = cardFor(result(), "BEAN", "a.near")!;
    assert.equal(c.status, "won");
    assert.equal(c.got, 400_000);
    assert.equal(c.paid, 12_000);
    assert.equal(c.refunded, 8_000);
    assert.equal(c.effectivePrice, 0.03);
    assert.equal(c.savedVsLimit, 8_000, "0.05 x 400,000 = 20,000 at their limit, paid 12,000");
  });
  it("marks a partial fill and carries the agent flag", () => {
    const c = cardFor(result(), "BEAN", "b.near")!;
    assert.equal(c.status, "partly");
    assert.deepEqual(c.agent, { signed: true });
  });
  it("marks a priced-out bid with no effective price", () => {
    const c = cardFor(result(), "BEAN", "d.near")!;
    assert.equal(c.status, "lost");
    assert.equal(c.effectivePrice, null);
    assert.equal(c.savedVsLimit, null);
    assert.equal(c.refunded, 4_000);
  });
  it("returns null for someone who did not bid", () => assert.equal(cardFor(result(), "BEAN", "nobody.near"), null));
});

describe("cardText and cardSvg", () => {
  it("writes a sharable line with only public facts", () => {
    const text = cardText(cardFor(result(), "BEAN", "a.near")!);
    assert.match(text, /400,000 BEAN/);
    assert.match(text, /saving \$8,000/);
    assert.match(text, /one clearing price/);
    assert.doesNotMatch(text, /a\.near/, "the account id is not in the text");
    assert.match(cardText(cardFor(result(), "BEAN", "b.near")!), /my agent bid inside rules I set/);
    assert.match(cardText(cardFor(result(), "BEAN", "d.near")!), /priced out and fully refunded/);
  });
  it("draws a 1200x630 image with the numbers and is valid-looking XML", () => {
    const svg = cardSvg(cardFor(result(), "BEAN", "a.near")!);
    assert.match(svg, /^<svg [^>]*width="1200" height="630"/);
    for (const needle of ["400,000 BEAN", "$12,000", "$8,000", "$0.03", "WON", "development result: not attested"]) assert.ok(svg.includes(needle), needle);
    assert.ok(!/gradient/i.test(svg), "flat colours only");
  });
  it("escapes anything that could break the image", () => {
    const svg = cardSvg(cardFor(result({ allocations: [{ bidder: 'x"<&>.near', limit: 0.05, qty: 1, filled: 1, paid: 0.03, refund: 0.02 }] }), "A&B", 'x"<&>.near')!);
    assert.ok(!svg.includes('x"<&>.near'));
    assert.ok(svg.includes("x&quot;&lt;&amp;&gt;.near") && svg.includes("A&amp;B"));
  });
  it("says attested only for a real attestation", () => {
    assert.match(cardSvg(cardFor(result({ mode: "tee" }), "BEAN", "a.near")!), /attested result/);
  });
});
