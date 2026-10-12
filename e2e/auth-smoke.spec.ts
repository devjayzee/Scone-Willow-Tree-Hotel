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
  "/", // redirects to /login for signed-out visitors
  "/login",
  "/forgot-password",
  "/reset-password?token=fake-token-for-render-check",
  "/setup-password?token=fake-token-for-render-check",
  "/this-page-does-not-exist", // not-found page (h1 "404")
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

// Nonce-based CSP checks (plan feat-nonce-csp, tests 17-19). Every HTML
// response must carry a per-request nonce CSP, every <script> must carry
// that nonce, and the browser must report no violations. A static page
// (no nonce) or a stale nonce fails here, which is the #130 class.

// Records securitypolicyviolation events in the page. Read back with
// readViolations(). The init script runs before any page script.
async function recordViolations(page: Page) {
  await page.addInitScript(() => {
    const w = window as unknown as { __cspViolations: string[] };
    w.__cspViolations = [];
    document.addEventListener("securitypolicyviolation", (e) => {
      w.__cspViolations.push(`${e.violatedDirective} ${e.blockedURI}`);
    });
  });
}

async function readViolations(page: Page): Promise<string[]> {
  return page.evaluate(
    () =>
      (window as unknown as { __cspViolations?: string[] }).__cspViolations ??
      [],
  );
}

function cspHeaders(headers: Record<string, string>): string[] {
  return Object.entries(headers)
    .filter(([name]) => name.toLowerCase() === "content-security-policy")
    .map(([, value]) => value);
}

for (const path of AUTH_PAGES) {
  test.describe(`nonce CSP: ${path}`, () => {
    test("response CSP is nonce-based and every server-rendered script carries the nonce", async ({
      page,
    }) => {
      const { consoleErrors, pageErrors } = captureBrowserErrors(page);
      await recordViolations(page);

      const response = await page.goto(path);
      await page.waitForLoadState("networkidle");
      await expect(page.locator("h1").first()).toBeVisible();

      const csps = cspHeaders(await response!.allHeaders());
      expect(csps, "exactly one CSP header").toHaveLength(1);
      const csp = csps[0];

      const scriptSrc = csp
        .split(";")
        .map((d) => d.trim())
        .find((d) => d.startsWith("script-src "));
      expect(scriptSrc, "script-src directive").toBeDefined();
      expect(scriptSrc).toContain("'strict-dynamic'");
      expect(scriptSrc).not.toContain("'unsafe-inline'");
      const nonce = /'nonce-([^']+)'/.exec(scriptSrc!)?.[1];
      expect(nonce, "nonce in script-src").toBeTruthy();

      // Check the server HTML, not the live DOM: Turbopack's runtime adds
      // chunk <script>s with no nonce, which 'strict-dynamic' allows.
      // Every script the server rendered must carry the header's nonce.
      const html = await response!.text();
      const tags = html.match(/<script\b[^>]*>/g) ?? [];
      expect(tags.length, "server HTML has scripts").toBeGreaterThan(0);
      for (const tag of tags) {
        expect(tag, "server-rendered script carries the nonce").toContain(
          `nonce="${nonce}"`,
        );
      }

      expect(await readViolations(page), "no CSP violations").toEqual([]);
      expect(pageErrors, "no uncaught page errors").toEqual([]);
      expect(consoleErrors, "no console errors").toEqual([]);
    });
  });
}

test.describe("hydration under the nonce CSP", () => {
  test("/login password visibility toggle flips the input type", async ({
    page,
  }) => {
    await page.goto("/login");
    await page.waitForLoadState("networkidle");

    const password = page.locator("#password");
    await password.fill("not-a-real-password");
    await expect(password).toHaveAttribute("type", "password");

    await page.getByRole("button", { name: "Show password" }).click();
    await expect(password).toHaveAttribute("type", "text");
  });

  // Detector: proves this smoke can see a #130-class failure. The
  // response CSP is rewritten to a nonce the page's scripts don't carry,
  // so the browser blocks them and the page never hydrates.
  test("a wrong nonce in the CSP is caught: violations, and the toggle stays dead", async ({
    page,
  }) => {
    await recordViolations(page);
    await page.route("**/login", async (route) => {
      if (route.request().resourceType() !== "document") {
        return route.continue();
      }
      const response = await route.fetch();
      const headers = response.headers();
      headers["content-security-policy"] = headers[
        "content-security-policy"
      ].replace(/'nonce-[^']+'/, "'nonce-d3Jvbmctbm9uY2U='");
      await route.fulfill({ response, headers });
    });

    await page.goto("/login");
    await page.waitForLoadState("networkidle");

    const password = page.locator("#password");
    await password.fill("not-a-real-password");
    await page.getByRole("button", { name: "Show password" }).click();

    expect(
      (await readViolations(page)).length,
      "blocked scripts are reported",
    ).toBeGreaterThan(0);
    await expect(password).toHaveAttribute("type", "password");
  });
});
