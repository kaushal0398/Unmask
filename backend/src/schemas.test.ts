import assert from "node:assert/strict";
import { test } from "node:test";
import { createLaunchSchema } from "./schemas.js";

const base = { name: "Bean", symbol: "BEAN", creator: "a.near", supplyAtomic: "1000", reserveAtomic: "5", tokenDecimals: 0, paymentToken: "usdc.near", paymentDecimals: 6, closesAt: "2030-01-01T00:00:00.000Z" };

test("a launch without an image is valid", () => {
  assert.equal(createLaunchSchema.safeParse(base).success, true);
});

test("a small png/jpeg/webp data URL is accepted", () => {
  for (const t of ["png", "jpeg", "webp"]) {
    assert.equal(createLaunchSchema.safeParse({ ...base, image: `data:image/${t};base64,AAAA` }).success, true, t);
  }
});

test("anything else is rejected: other types, non-data URLs, scripts, oversize", () => {
  for (const image of ["https://evil.example/x.png", "data:text/html;base64,AAAA", "data:image/svg+xml;base64,AAAA", "javascript:alert(1)", `data:image/png;base64,${"A".repeat(120_000)}`]) {
    assert.equal(createLaunchSchema.safeParse({ ...base, image }).success, false, image.slice(0, 30));
  }
});
