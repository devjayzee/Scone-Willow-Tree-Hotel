# Releasing

`development` → `main` PRs go through the browser-smoke checklist below.
The automated Playwright smoke (`smoke` job in `.github/workflows/test.yml`)
catches CSP / hydration / chunk-load regressions on every PR. This
checklist covers the failure classes automation can't see —
visual regressions, missing content, subtle UX breakage.

The immediate reason we run this: PR #130's `script-src 'self'` CSP
outage shipped because every verification was `curl`-based. Do this
manually on release PRs even after Playwright lands — it's cheap and
catches a different class of bug.

## Before merging a release PR

1. Open the Vercel preview URL from the PR's checks.
2. Open browser devtools → **Console** tab.
3. Reload each of the four auth pages and confirm zero console errors:
   - `/login`
   - `/forgot-password`
   - `/reset-password?token=fake-token-for-render-check`
   - `/setup-password?token=fake-token-for-render-check`
4. Sign in with the demo GM account (`manager@hotel.com` / your `SEED_MANAGER_PASSWORD` value).
   - After sign-in, click through the four dashboard tabs:
     `/bookings`, `/calendar`, `/rooms`, `/reports`, `/staff`.
   - Confirm each renders and no console errors appear.
5. Across steps 3 and 4, confirm the console shows no `Refused to …` or
   `violates the following Content Security Policy` lines. The Vercel
   Preview toolbar must be off first (project setting, or
   `VERCEL_PREVIEW_FEEDBACK_ENABLED=0` on Preview). Its `vercel.live`
   scripts are blocked by the CSP, so `vercel.live` violations mean the
   toolbar is on, not that the CSP is wrong.
6. Confirm each HTML response carries exactly one CSP header (prints `1`):
   `curl -sI <preview>/login | grep -ci '^content-security-policy'`
   Repeat for `/`, `/does-not-exist` and a signed-in `/bookings`.
   A protected preview needs `vercel curl` (or the
   `x-vercel-protection-bypass: <secret>` header), and the signed-in
   `/bookings` check needs a session cookie (`-b` with a cookie jar).
7. Sign out and hit `/login` again — the form must respond to a click
   (proves hydration completed).

If any step fails, block the release and open an issue with the
console output.

## Signed-in CSP check (local or preview)

`e2e/dashboard-csp.spec.ts` signs in and exercises `/bookings`,
`/calendar`, `/reports`, `/rooms` and `/staff`, failing on any CSP
violation, console error or page error. It needs a seeded database, so it
is skipped (and never runs in CI) unless the credentials are set:

```bash
PLAYWRIGHT_BASE_URL=<url> \
E2E_LOGIN_EMAIL=manager@hotel.com \
E2E_LOGIN_PASSWORD=<SEED_MANAGER_PASSWORD> \
npx playwright test dashboard-csp
```

For a protected Vercel preview, also set `VERCEL_AUTOMATION_BYPASS_SECRET`.

## Notes

- Do NOT run this against production. Preview URL only.
- The Playwright smoke covers step 3 (no console errors on the auth
  pages), the nonce CSP header and zero violations on `/` and the 404
  page, and step 7 (the `/login` toggle responds, so hydration ran).
  Steps 4 to 6 stay manual, though `dashboard-csp.spec.ts` can automate
  step 4 when run with credentials.
- `docs/RELEASING.md` is intentionally short. If this list grows past
  a page, promote items to Playwright specs instead.
