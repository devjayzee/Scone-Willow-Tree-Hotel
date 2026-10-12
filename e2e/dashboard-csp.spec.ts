import { test, expect, type ConsoleMessage, type Page } from "@playwright/test";

// Signed-in dashboard check under the nonce CSP (plan feat-nonce-csp).
// Needs a real database with a seeded user, so it never runs in CI: it
// is skipped unless E2E_LOGIN_EMAIL and E2E_LOGIN_PASSWORD are set.
//
//   PLAYWRIGHT_BASE_URL=<url> E2E_LOGIN_EMAIL=manager@hotel.com \
//   E2E_LOGIN_PASSWORD=<seed GM password> npx playwright test dashboard-csp
//
// Each page must render, one interaction must work (proof that React
// hydrated), and the browser must report no CSP violations, console
// errors or page errors. The reports page has no chart library; its
// "chart" is the Room Performance table, re-rendered by a date filter.

const EMAIL = process.env.E2E_LOGIN_EMAIL;
const PASSWORD = process.env.E2E_LOGIN_PASSWORD;

test.skip(
  !EMAIL || !PASSWORD,
  "set E2E_LOGIN_EMAIL and E2E_LOGIN_PASSWORD to run the signed-in CSP check",
);

interface Captured {
  stop: () => void;
  violations: () => Promise<string[]>;
  consoleErrors: string[];
  pageErrors: string[];
}

function capture(): Captured {
  const consoleErrors: string[] = [];
  const pageErrors: string[] = [];
  const onConsole = (msg: ConsoleMessage) => {
    if (msg.type() === "error") consoleErrors.push(msg.text());
  };
  const onPageError = (err: Error) => pageErrors.push(err.message);
  page.on("console", onConsole);
  page.on("pageerror", onPageError);
  return {
    stop: () => {
      page.off("console", onConsole);
      page.off("pageerror", onPageError);
    },
    consoleErrors,
    pageErrors,
    violations: () =>
      page.evaluate(
        () =>
          (window as unknown as { __cspViolations?: string[] })
            .__cspViolations ?? [],
      ),
  };
}

// Exactly one CSP header, nonce-based, with no 'unsafe-inline' in script-src.
async function expectNonceCsp(
  response: Awaited<ReturnType<Page["goto"]>>,
) {
  const headers = await response!.allHeaders();
  const csps = Object.entries(headers)
    .filter(([name]) => name.toLowerCase() === "content-security-policy")
    .map(([, value]) => value);
  expect(csps, "exactly one CSP header").toHaveLength(1);
  expect(csps[0]).toContain("'nonce-");
  expect(csps[0]).toContain("'strict-dynamic'");
  const scriptSrc = csps[0]
    .split(";")
    .map((d) => d.trim())
    .find((d) => d.startsWith("script-src "));
  expect(scriptSrc, "script-src directive").toBeDefined();
  expect(scriptSrc).not.toContain("'unsafe-inline'");
}

async function expectClean(c: Captured) {
  c.stop();
  expect(await c.violations(), "no CSP violations").toEqual([]);
  expect(c.pageErrors, "no uncaught page errors").toEqual([]);
  expect(c.consoleErrors, "no console errors").toEqual([]);
}

// One sign-in for the whole file: the login rate limit would lock the
// account out if each test signed in separately.
test.describe.configure({ mode: "serial" });

let page: Page;

test.beforeAll(async ({ browser }, testInfo) => {
  // A context made in beforeAll does not inherit the config's `use`.
  const { baseURL, extraHTTPHeaders } = testInfo.project.use;
  const context = await browser.newContext({ baseURL, extraHTTPHeaders });
  await context.addInitScript(() => {
    const w = window as unknown as { __cspViolations: string[] };
    w.__cspViolations = [];
    document.addEventListener("securitypolicyviolation", (e) => {
      w.__cspViolations.push(`${e.violatedDirective} ${e.blockedURI}`);
    });
  });
  page = await context.newPage();
  await page.goto("/login");
  await page.locator("#email").fill(EMAIL!);
  await page.locator("#password").fill(PASSWORD!);
  await page.getByRole("button", { name: /sign in/i }).click();
  await page.waitForURL((url) => !url.pathname.startsWith("/login"));
});

test.afterAll(async () => {
  await page.context().close();
});

test("/bookings: the new-booking dialog opens and closes", async () => {
  const c = capture();
  const response = await page.goto("/bookings");
  await expectNonceCsp(response);
  await expect(page.getByRole("heading", { name: "Bookings" })).toBeVisible();

  await page.getByRole("button", { name: "New Booking" }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByText("New Booking")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();

  await expectClean(c);
});

test("/calendar: the grid renders and navigation works", async () => {
  const c = capture();
  const response = await page.goto("/calendar");
  await expectNonceCsp(response);
  await expect(page.locator(".rbc-month-view")).toBeVisible();

  // Desktop toolbar: the month label sits in the h2 next to the arrows.
  const label = page.getByRole("heading", { level: 2, name: /^\w+ \d{4}$/ });
  const toolbar = label.locator("..");
  const before = await label.textContent();
  await toolbar.locator("button:has(svg.lucide-chevron-right)").click();
  await expect(label).not.toHaveText(before!);
  const after = await label.textContent();
  await toolbar.locator("button:has(svg.lucide-chevron-left)").click();
  await expect(label).not.toHaveText(after!);
  await expect(page.locator(".rbc-month-view")).toBeVisible();

  await expectClean(c);
});

test("/reports: the table renders and a date filter re-renders it", async () => {
  const c = capture();
  const response = await page.goto("/reports");
  await expectNonceCsp(response);
  await expect(
    page.getByRole("heading", { name: "Reports & Analytics" }),
  ).toBeVisible();
  const table = page.locator("table:visible");
  await expect(table.getByText("Total Bookings")).toBeVisible();

  const picker = page.getByRole("button", { name: /select date range/i });
  await picker.click();
  await page
    .getByRole("button", { name: "Last 30 days" })
    .locator("visible=true")
    .click();
  await page.getByRole("button", { name: "Apply" }).locator("visible=true").click();
  // The trigger now shows the chosen range instead of the placeholder.
  await expect(
    page.getByRole("button", { name: /select date range/i }),
  ).toHaveCount(0);
  await expect(table.getByText("Total Bookings")).toBeVisible();

  await expectClean(c);
});

test("/rooms: the table renders and the add dialog opens", async () => {
  const c = capture();
  const response = await page.goto("/rooms");
  await expectNonceCsp(response);
  await expect(page.getByRole("table", { name: "Rooms table" })).toBeVisible();

  await page.getByRole("button", { name: "Add Room" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toBeHidden();

  await expectClean(c);
});

test("/staff: the table renders and the add dialog opens", async () => {
  const c = capture();
  const response = await page.goto("/staff");
  await expectNonceCsp(response);
  await expect(
    page.getByRole("table", { name: "Staff members table" }),
  ).toBeVisible();

  await page.getByRole("button", { name: "Add Staff" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toBeHidden();

  await expectClean(c);
});
