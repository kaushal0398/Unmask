import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  timeout: 45_000,
  retries: 1,
  use: { baseURL: "http://localhost:3000", launchOptions: { executablePath: process.env.CHROME_PATH ?? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" } },
  webServer: { command: "npx next dev -p 3000", url: "http://localhost:3000", reuseExistingServer: true, timeout: 120_000 },
});
