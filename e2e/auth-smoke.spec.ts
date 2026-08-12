import { test, expect, type Page, type ConsoleMessage } from "@playwright/test";

// Post-deploy browser smoke for the four public auth pages (#135 /
// audit A1). Catches the exact regression class that shipped PR
// #130's CSP outage: pages that curl fetches successfully but the
// browser can't render due to blocked inline scripts, chunk load
// failures, or hydration errors.
//
// Scope is deliberately narrow — render + hydration. Full form-submit
// flows against a live DB belong in a follow-up integration harness.

const AUTH_PAGES = [
  { path: "/login", primarySelector: 'button[type="submit"]' },
  { path: "/forgot-password", primarySelector: 'button[type="submit"]' },
  {
    path: "/reset-password?token=fake-token-for-render-check",
    primarySelector: 'button[type="submit"]',
  },
  {
    path: "/setup-password?token=fake-token-for-render-check",
    primarySelector: 'button[type="submit"]',
  },
];

// Attach console + page-error listeners. Returns two arrays that
// tests assert are empty after `page.goto` completes.
function captureBrowserErrors(page: Page) {
  const consoleErrors: string[] = [];
  const pageErrors: string[] = [];

  page.on("console", (msg: ConsoleMessage) => {
    if (msg.type() === "error") {
      consoleErrors.push(msg.text());
    }
  });
  page.on("pageerror", (err: Error) => {
    pageErrors.push(err.message);
  });

  return { consoleErrors, pageErrors };
}

for (const { path, primarySelector } of AUTH_PAGES) {
  test.describe(`auth page: ${path}`, () => {
    test("renders without console or page errors and hydrates the submit button", async ({
      page,
    }) => {
      const { consoleErrors, pageErrors } = captureBrowserErrors(page);

      await page.goto(path);
      await page.waitForLoadState("networkidle");

      // Hydration proof: the primary submit button exists and is enabled
      // after the app boots. A CSP block on inline scripts stops the
      // React bundle from executing, which stops the form from mounting.
      const submit = page.locator(primarySelector).first();
      await expect(submit).toBeVisible();
      await expect(submit).toBeEnabled();

      expect(pageErrors, "no uncaught page errors").toEqual([]);
      expect(consoleErrors, "no console errors").toEqual([]);
    });
  });
}
