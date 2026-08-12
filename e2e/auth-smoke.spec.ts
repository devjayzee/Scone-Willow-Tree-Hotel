import { test, expect, type Page, type ConsoleMessage } from "@playwright/test";

// Post-deploy browser smoke for the four public auth pages (#135 /
// audit A1). Catches the exact regression class that shipped PR
// #130's CSP outage: pages that curl fetches successfully but the
// browser can't render due to blocked inline scripts, chunk load
// failures, or hydration errors.
//
// Scope is deliberately narrow — render + hydration. Full form-submit
// flows against a live DB belong in a follow-up integration harness.
//
// The four pages render two different shapes:
// - /login and /forgot-password: always render their sign-in / reset
//   form (submit button present).
// - /reset-password and /setup-password: token-gated. Without a
//   valid token (we don't have one — no DB in the smoke), they
//   render the ExpiredLinkScreen fallback (no submit button, just a
//   Link acting as a button).
//
// The common denominator that proves render + hydration for all
// four is: an <h1> exists and no console/pageerror fires. A
// hydration mismatch always logs a React error to console, so
// "no console errors" IS the hydration check.

const AUTH_PAGES = [
  "/login",
  "/forgot-password",
  "/reset-password?token=fake-token-for-render-check",
  "/setup-password?token=fake-token-for-render-check",
];

// Browser-emitted network errors ("Failed to load resource: the
// server responded with a status of X") are expected when the smoke
// hits API endpoints without a real DB (e.g. /setup-password calls
// /api/auth/invite/<fake-token>, which 500s because Prisma has
// nothing to query). Filter them out — they're not the CSP /
// hydration failure class the smoke is here to catch.
//
// Everything else stays: real JS errors, CSP violations
// ("Refused to execute inline script..."), and React hydration
// mismatches all surface as console errors with different text.
function isExpectedNetworkError(text: string): boolean {
  return /Failed to load resource: the server responded with a status of (4|5)\d\d/.test(
    text,
  );
}

// Attach console + page-error listeners. Returns two arrays that
// tests assert are empty after `page.goto` completes.
function captureBrowserErrors(page: Page) {
  const consoleErrors: string[] = [];
  const pageErrors: string[] = [];

  page.on("console", (msg: ConsoleMessage) => {
    if (msg.type() === "error" && !isExpectedNetworkError(msg.text())) {
      consoleErrors.push(msg.text());
    }
  });
  page.on("pageerror", (err: Error) => {
    pageErrors.push(err.message);
  });

  return { consoleErrors, pageErrors };
}

for (const path of AUTH_PAGES) {
  test.describe(`auth page: ${path}`, () => {
    test("renders an h1 and hydrates without console or page errors", async ({
      page,
    }) => {
      const { consoleErrors, pageErrors } = captureBrowserErrors(page);

      await page.goto(path);
      await page.waitForLoadState("networkidle");

      // Render proof: an <h1> is visible. Present on every auth-page
      // variant (form heading OR ExpiredLinkScreen heading).
      await expect(page.locator("h1").first()).toBeVisible();

      // Hydration proof: React logs a hydration mismatch to console,
      // and a CSP block on inline scripts surfaces the same way. No
      // console errors → hydration completed cleanly → this catches
      // the #130 regression class.
      expect(pageErrors, "no uncaught page errors").toEqual([]);
      expect(consoleErrors, "no console errors").toEqual([]);
    });
  });
}

// Nonce-CSP regression guard (#141). Exercises just /login (the four
// auth pages share the same middleware-driven CSP header). Two things
// must hold: the response carries a Content-Security-Policy header
// with a `nonce-` allowlist, and the browser doesn't log any
// "Refused to execute inline script" CSP violations for the page.
test.describe("nonce-based CSP (#141)", () => {
  test("/login: response includes a nonce'd script-src and browser reports no CSP violations", async ({
    page,
  }) => {
    const { consoleErrors } = captureBrowserErrors(page);

    const response = await page.goto("/login");
    expect(response).not.toBeNull();

    const csp = response!.headers()["content-security-policy"];
    expect(csp, "CSP header present").toBeDefined();
    expect(csp).toMatch(/'nonce-[^']+'/);
    expect(csp).toContain("'strict-dynamic'");

    await page.waitForLoadState("networkidle");

    // A nonce-mis-wire surfaces as this exact console message from
    // the browser. If it appears, the CSP header was set but Next
    // didn't nonce its own hydration scripts — the failure mode we
    // deferred fixing in the #130 hotfix.
    const cspViolations = consoleErrors.filter((msg) =>
      msg.includes("Refused to execute inline script"),
    );
    expect(cspViolations).toEqual([]);
  });
});
