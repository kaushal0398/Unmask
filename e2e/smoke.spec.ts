import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

const ROUTES = ["/", "/launches", "/launches/moonbean", "/launches/pixelpup", "/launches/new", "/verify", "/how-it-works", "/compare", "/faq", "/limits", "/portfolio", "/creators"];

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

// FIXME(needs backend): these four predate the backend integration and fail on the commit before the agent, payout, funding and
// result-card work too. The demo wallet cannot sign in, so the bid and create flows cannot reach "seal" any more; the clock test
// stays on "The enclave is counting". They need either a backend in CI with a real test wallet or the old in-memory path back.
test.fixme("bid flow: connect demo wallet, confirm, seal, withdraw", async ({ page }) => {
  await page.goto("/launches/moonbean");
  await page.getByRole("button", { name: "use demo wallet" }).first().click();
  await page.getByLabel("Limit price per token in dollars").fill("0.05");
  await page.getByLabel("Quantity of tokens").fill("10000");
  await page.getByRole("button", { name: "Seal my bid" }).click();
  await page.getByRole("button", { name: /Lock .* and seal/ }).click();
  await expect(page.getByRole("heading", { name: "Your bid is sealed" })).toBeVisible({ timeout: 15_000 });
  await page.getByRole("button", { name: "Withdraw my bid" }).click();
  await page.getByRole("button", { name: "Withdraw bid" }).click();
  await expect(page.getByText(/Bid withdrawn/).first()).toBeVisible({ timeout: 15_000 });
});

test.fixme("a failed payment check shows an error and keeps the form", async ({ page }) => {
  await page.goto("/launches/moonbean?demo=1");
  await page.getByRole("button", { name: "use demo wallet" }).first().click();
  await page.getByRole("button", { name: "Fail the next payment check" }).click();
  await page.getByLabel("Limit price per token in dollars").fill("0.05");
  await page.getByLabel("Quantity of tokens").fill("10000");
  await page.getByRole("button", { name: "Seal my bid" }).click();
  await page.getByRole("button", { name: /Lock .* and seal/ }).click();
  await expect(page.getByRole("alert").filter({ hasText: "intents balance" }).first()).toBeVisible({ timeout: 15_000 });
});

test.fixme("fast-forwarding the clock settles an open launch", async ({ page }) => {
  await page.goto("/launches/moonbean?demo=1");
  await page.getByRole("button", { name: "Skip to the close" }).click();
  await expect(page.getByText("The enclave is counting")).toBeVisible();
  await page.getByRole("button", { name: "600×" }).click();
  await expect(page.getByText("Cleared at one price for everyone")).toBeVisible({ timeout: 20_000 });
});

test.fixme("create launch: a failed step can be retried", async ({ page }) => {
  await page.goto("/launches/new?demo=1");
  await page.getByPlaceholder("MoonBean", { exact: true }).fill("Test Coin");
  await page.getByPlaceholder("BEAN", { exact: true }).fill("TST");
  await page.getByRole("button", { name: "Fail the next create at step 2" }).click();
  await page.keyboard.press("d"); // hide the demo panel so it does not cover the form
  await page.getByRole("button", { name: "Create launch" }).click();
  await page.getByRole("button", { name: "Create launch" }).last().click();
  await page.getByRole("button", { name: "Retry from this step" }).click({ timeout: 20_000 });
  await expect(page.getByText(/is ready to open/).first()).toBeVisible({ timeout: 20_000 });
});
