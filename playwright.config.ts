import { defineConfig, devices } from "@playwright/test";

// Browser smoke for auth pages (#135) — catches CSP / hydration /
// chunk-load regressions that curl and vitest can't see. Deliberately
// scoped to render + hydration checks; full form-submit flows need a
// live DB and belong in a follow-up.
const BASE_URL = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: BASE_URL,
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  // Boot the built app on port 3000 unless one is already running
  // (dev machine). CI passes PLAYWRIGHT_BASE_URL and skips this block
  // when it's already pointed at a running server.
  webServer: process.env.PLAYWRIGHT_BASE_URL
    ? undefined
    : {
        command: "npm run start",
        url: "http://localhost:3000",
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
      },
});
