import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 30_000,
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  // `github` annotates the run; `html` writes playwright-report/, which the CI upload step
  // expects on failure (macro-engine#262). The `github` reporter alone wrote nothing to disk.
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: process.env.BASE_URL ?? "http://localhost:3457",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    viewport: { width: 1440, height: 900 },
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile", use: { ...devices["iPhone 14"] } },
  ],
  webServer: process.env.CI
    ? { command: "npm run dev -- -p 3457", port: 3457, reuseExistingServer: false, timeout: 120_000 }
    : { command: "npm run dev -- -p 3457", port: 3457, reuseExistingServer: true },
});
