import AxeBuilder from "@axe-core/playwright";
import { readFileSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";

const ROUTES = ["/", "/launches", "/launches/moonbean", "/launches/pixelpup", "/launches/new", "/verify", "/how-it-works", "/compare", "/faq", "/limits", "/portfolio", "/creators", "/my-bids"];

for (const route of ROUTES) {
  test(`${route} loads, fits a phone and has no serious a11y problems`, async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.setViewportSize({ width: 375, height: 800 });
    await page.goto(route);
    await expect(page.locator("h1").first()).toBeVisible();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow, "horizontal overflow at 375px").toBeLessThanOrEqual(0);
    await page.waitForTimeout(1500); // let the entrance animations finish before measuring contrast
    const res = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze();
    const bad = res.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
    expect(bad.map((v) => `${v.id}: ${v.nodes[0]?.html.slice(0, 100)}`)).toEqual([]);
    expect(errors).toEqual([]);
  });
}

// ---- The flows below stub the backend with Playwright routes, so they run anywhere without a database. ----
// (The older bid, payment-failure, clock and create tests assumed the demo wallet could seal a bid. It cannot sign in
// any more, so they were replaced by these, which test what a person can do today.)

const REAL_QUOTE = JSON.parse(readFileSync("src/lib/intents/fixtures/quote-dry.json", "utf8"));
const CORS = { "access-control-allow-origin": "http://localhost:3000", "access-control-allow-headers": "*", "access-control-allow-methods": "GET,POST,OPTIONS" };
const ARB_USDC = "nep141:arb-0xaf88d065e77c8cc2239327c5edb3a432268e5831.omft.near";
const ARB_ADDRESS = "0x2527D02599Ba641c19FEa793cD0F167589a0f10D";

async function stubBackend(page: Page, routes: { launch?: unknown; result?: unknown; list?: unknown[] } = {}) {
  await page.route("**/127.0.0.1:4001/**", async (route) => {
    const req = route.request();
    const url = new URL(req.url());
    const json = (status: number, body: unknown) => route.fulfill({ status, headers: { ...CORS, "content-type": "application/json" }, body: JSON.stringify(body) });
    if (req.method() === "OPTIONS") return route.fulfill({ status: 204, headers: CORS });
    if (url.pathname === "/v1/intents/tokens") return json(200, [{ assetId: ARB_USDC, blockchain: "arb", symbol: "USDC", decimals: 6 }, { assetId: "nep141:eth.omft.near", blockchain: "eth", symbol: "ETH", decimals: 18 }]);
    if (url.pathname === "/v1/intents/quote" && req.method() === "POST") return json(201, REAL_QUOTE);
    if (routes.list && url.pathname === "/v1/launches") return json(200, { launches: routes.list });
    if (routes.launch && /^\/v1\/launches\/[^/]+$/.test(url.pathname)) return json(200, { launch: routes.launch });
    if (routes.result && url.pathname.endsWith("/result")) return json(200, { result: routes.result });
    return json(404, { error: { code: "not_found", message: "not found" } });
  });
}

async function openSampleBidForm(page: Page) {
  await stubBackend(page);
  await page.goto("/launches/moonbean");
  await page.getByRole("button", { name: "use demo wallet" }).first().click();
  await page.getByLabel("Limit price per token in dollars").waitFor();
}

test("agent mode: with the demo wallet the rules are set and shown as unsigned", async ({ page }) => {
  await openSampleBidForm(page);
  await page.getByLabel(/Let an agent place this bid/i).check();
  await page.getByRole("button", { name: /Set the rules/i }).click();
  const summary = page.getByTestId("agent-summary");
  await expect(summary).toBeVisible();
  await expect(summary).toContainText("not signed (demo wallet)");
  await expect(summary).toContainText("Rules hash");
  await expect(summary).toContainText("You still pay only the clearing price");
  await expect(page.getByLabel("Limit price per token in dollars")).toBeDisabled();
});

test("refund destination: a bad address is caught before sealing and a good one is accepted", async ({ page }) => {
  await openSampleBidForm(page);
  await page.getByLabel(/Send my refund and tokens somewhere else/i).check();
  await page.getByLabel("Refund chain").selectOption("arb");
  await page.getByLabel("Refund address").fill("0x123");
  await expect(page.getByRole("alert").filter({ hasText: "Refund address" })).toContainText("not a 0x address with 40 hex characters");
  await page.getByLabel("Refund address").fill(ARB_ADDRESS);
  await expect(page.getByRole("alert").filter({ hasText: "Refund address" })).toHaveCount(0);
  await page.getByLabel("Token address").fill("Not A Name");
  await expect(page.getByRole("alert").filter({ hasText: "Token address" })).toBeVisible();
});

test("pay from another chain: shows a price preview and says nothing is paid", async ({ page }) => {
  await openSampleBidForm(page);
  await page.getByRole("button", { name: /Pay from another chain/i }).click();
  await expect(page.getByLabel("Pay with")).toHaveValue(ARB_USDC);
  await page.getByLabel("Refund address on the paying chain").fill(ARB_ADDRESS);
  await page.getByRole("button", { name: /Get a price for/i }).click();
  const quote = page.getByTestId("funding-quote");
  await expect(quote).toBeVisible();
  await expect(quote).toContainText("5.051108 USDC");
  await expect(quote).toContainText("none: a preview, nothing to pay");
  await expect(page.getByText(/Nothing is sent/)).toBeVisible();
});

test("a settled backend launch shows its real result, the payout plan and an honest evidence line", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  const fill = (bidId: string, bidder: string, limit: string, qty: string, filled: string, payment: string, refund: string) => ({ bidId, bidder, limitPrice: limit, requested: qty, filled, locked: String(Number(payment) + Number(refund)), payment, refund });
  await stubBackend(page, {
    launch: { id: "e2e-settled", name: "E2E Coin", symbol: "E2E", creator: "creator.testnet", supplyAtomic: "1000000", reserveAtomic: "10000", tokenDecimals: 0, paymentToken: "usdc.test", paymentDecimals: 6, capBps: null, status: "settled", closesAt: "2026-01-01T00:00:00.000Z", bidCount: 4, tokenContract: null, codeHash: null },
    result: {
      mode: "dev", launchId: "e2e-settled", clearingPrice: "30000", sold: "1000000", totalRaised: "30000000000", inputHash: "a".repeat(64), codeHash: "b".repeat(64), attestation: null, skippedBids: 1, settledAt: "2026-01-01T00:05:00.000Z",
      outcome: {
        unsold: "0",
        fills: [fill("1", "ana.testnet", "50000", "400000", "400000", "12000000000", "8000000000"), fill("2", "ben.testnet", "40000", "300000", "300000", "9000000000", "3000000000"), fill("3", "chi.testnet", "30000", "300000", "300000", "9000000000", "0"), fill("4", "dev.testnet", "20000", "200000", "0", "0", "4000000000")],
        skipped: [{ bidId: "bid-rogue-0001", reason: "agent bid breaks its rules: price_above_max" }],
        payouts: [{ bidId: "4", bidder: "dev.testnet", kind: "refund", amountAtomic: "4000000000", to: { chain: "arb", address: ARB_ADDRESS }, viaIntents: true }],
        payoutsExecuted: false,
        agents: [{ bidId: "2", bidder: "ben.testnet", rulesHash: "c".repeat(64), signed: false }],
      },
    },
  });
  await page.goto("/launches/e2e-settled");
  await expect(page.getByText(/cleared at one price for everyone/i).first()).toBeVisible({ timeout: 20_000 });
  const main = page.locator("main");
  await expect(main).toContainText("$0.03");
  await expect(main).toContainText("Every allocation");
  await expect(main.getByText("agent", { exact: true }).first()).toBeVisible();
  await expect(main).toContainText("via NEAR Intents");
  await expect(main).toContainText("No transfers have been made");
  await expect(main).toContainText("Bids left out");
  await expect(main).toContainText("agent bid breaks its rules: price_above_max");
  await expect(main).toContainText("none (development enclave)");
  await expect(main).not.toContainText("COUNTING");
  await expect(page.getByText("Development backend:")).toBeVisible();
  expect(errors).toEqual([]);
});

test("a launch the backend does not know shows not-found, not a blank page", async ({ page }) => {
  await stubBackend(page);
  const res = await page.goto("/launches/does-not-exist");
  expect(res?.status()).toBe(200);
  await expect(page.getByRole("heading").first()).toBeVisible({ timeout: 20_000 });
  await expect(page.locator("body")).not.toBeEmpty();
});

const BACKEND_LAUNCH = { id: "e2e-open", name: "E2E Coin", symbol: "E2E", creator: "creator.testnet", supplyAtomic: "1000000", reserveAtomic: "10000", tokenDecimals: 0, paymentToken: "usdc.test", paymentDecimals: 6, capBps: null, status: "open", closesAt: "2099-01-01T00:00:00.000Z", bidCount: 3, tokenContract: null, codeHash: null };

test("the launch list shows backend launches next to the samples", async ({ page }) => {
  await stubBackend(page, { list: [BACKEND_LAUNCH] });
  await page.goto("/launches");
  await expect(page.getByText("E2E Coin").first()).toBeVisible({ timeout: 20_000 });
  await expect(page.getByText("MoonBean").first()).toBeVisible();
});

test("the launch list still shows the samples, with no error, when the backend is off", async ({ page }) => {
  await page.goto("/launches");
  await expect(page.getByText("MoonBean").first()).toBeVisible({ timeout: 20_000 });
  await expect(page.getByText(/could not (connect|load)/i)).toHaveCount(0);
});

test("a bid receipt with no wallet connected explains what to do, not a blank page", async ({ page }) => {
  await page.goto("/my-bids/some-receipt-id");
  const main = page.locator("main");
  await expect(main).toContainText(/\w{4,}/, { timeout: 20_000 });
  expect((await main.innerText()).trim().length).toBeGreaterThan(20);
  await expect(main).not.toContainText("undefined");
});

test("a run on OutLayer is shown as unverified, never as attested", async ({ page }) => {
  const fill = { bidId: "1", bidder: "ana.testnet", limitPrice: "50000", requested: "400000", filled: "400000", locked: "20000000000", payment: "12000000000", refund: "8000000000" };
  await stubBackend(page, {
    launch: { id: "e2e-outlayer", name: "OL Coin", symbol: "OLC", creator: "creator.testnet", supplyAtomic: "400000", reserveAtomic: "10000", tokenDecimals: 0, paymentToken: "usdc.test", paymentDecimals: 6, capBps: null, status: "settled", closesAt: "2026-01-01T00:00:00.000Z", bidCount: 1, tokenContract: null, codeHash: null },
    result: {
      mode: "outlayer", launchId: "e2e-outlayer", clearingPrice: "30000", sold: "400000", totalRaised: "12000000000", inputHash: "a".repeat(64), codeHash: "b".repeat(64),
      attestation: "https://testnet-api.outlayer.ai/attestations/by-call/c1", skippedBids: 0, settledAt: "2026-01-01T00:05:00.000Z",
      outcome: { unsold: "0", fills: [fill], skipped: [], payouts: [], payoutsExecuted: false, agents: [], engineOutputHash: "d".repeat(64), engineKind: "outlayer" },
    },
  });
  await page.goto("/launches/e2e-outlayer");
  await expect(page.getByText(/cleared at one price for everyone/i).first()).toBeVisible({ timeout: 20_000 });
  const main = page.locator("main");
  await expect(main).toContainText("returned by OutLayer, not verified by us");
  await expect(main).toContainText("We have not verified it");
  await expect(main).not.toContainText("none (development enclave)");
  await expect(main.getByRole("link", { name: /returned by OutLayer/ })).toHaveAttribute("href", "https://testnet-api.outlayer.ai/attestations/by-call/c1");
  await expect(main).toContainText("Output hash");
  expect((await main.innerText()).toLowerCase()).not.toContain("attested result");
});
