# Releasing

`development` → `main` PRs go through the browser-smoke checklist below.
The automated Playwright smoke (`smoke` job in `.github/workflows/test.yml`)
catches CSP / hydration / chunk-load regressions on every PR. This
checklist covers the failure classes automation can't see —
visual regressions, missing content, subtle UX breakage.

The immediate reason we run this: PR #130's `script-src 'self'` CSP
outage shipped because every verification was `curl`-based. The audit
at `audits/auth-feature-audit-2026-08-09.md` §A1 tracked it. Do this
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
4. Sign in with the demo GM account (`manager@hotel.com` / `REDACTED`).
   - After sign-in, click through the four dashboard tabs:
     `/bookings`, `/calendar`, `/rooms`, `/reports`, `/staff`.
   - Confirm each renders and no console errors appear.
5. Sign out and hit `/login` again — the form must respond to a click
   (proves hydration completed).

If any step fails, block the release and open an issue with the
console output.

## Notes

- Do NOT run this against production. Preview URL only.
- The Playwright smoke covers steps 3 and 5 automatically on every PR.
  Manual step 4 is dashboard coverage the smoke doesn't attempt —
  it needs an authenticated session against a real DB.
- `docs/RELEASING.md` is intentionally short. If this list grows past
  a page, promote items to Playwright specs instead.
