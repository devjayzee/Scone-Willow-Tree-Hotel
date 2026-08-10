# Auth Feature Audit — 2026-08-09

**Scope:** the full auth surface built across PRs #127–#134 (login redesign, forgot/reset/setup pages, password-reset service, email transport, four public API routes, middleware whitelist), plus the fix trail (CSP hotfix #130, autocomplete #132, forced-light #133, tagline #134).

**Method:** two independent audits run in parallel — architecture-auditor agent against `.claude/rules/` 1–8, and a security review of the auth surface — synthesized with my own known-issues list. Findings verified in code before inclusion; one agent claim (that `use-login-form` was untested) was proven wrong and dropped.

---

## A. What actually went wrong (post-mortems)

### A1. The CSP outage — process failure, not just a config bug

`script-src 'self'` shipped without anyone loading a page in a browser. Every
verification I ran during the auth branches was **curl-based** — server HTML
only, which cannot detect a hydration failure. The bug sat on `development`
through 3 PRs and released to prod.

**Options:**
- **(a) Post-deploy browser smoke as a release checklist item** — Pro: catches
  this whole failure class (hydration, CSP, chunk errors). Con: manual,
  someone has to do it.
- **(b) A Playwright smoke test in CI** (`login → expect no console errors →
  submit`) — Pro: automated, catches regressions forever. Con: CI is
  currently disabled for quota reasons; adds a headless-browser dependency.

Recommendation: (a) now, (b) when CI comes back.

### A2. Credentials leaked into the URL

The GET fallback happened because the `<form>` has no `method`/`action`; when
JS is dead, browsers default to GET-with-query-params. That turned a rendering
bug into a **credential leak** (browser history + Vercel request logs).

**Fix (do regardless):** add `method="post"` to all four auth forms. Pro: one
attribute per form; a future JS failure produces a harmless failed POST
instead of a leak. Con: none. Pure defense-in-depth.

### A3. Silent email fallback put raw reset tokens in prod logs

`getEmailTransport()` silently logs the full reset link when Resend env is
missing — deliberately useful in dev, but **prod inherited it silently**.
Anyone with Vercel dashboard access can read live reset links.

**Options:**
- **(a) Fail fast:** in `NODE_ENV === "production"`, missing `RESEND_API_KEY`
  throws at first send. Pro: impossible to run prod in log-leak mode
  unknowingly. Con: forgot-password 500s until env is set (loud beats silent).
- **(b) Explicit opt-in:** `EMAIL_MODE=log` env required for the dev
  transport. Pro: intent is always explicit. Con: one more env var
  everywhere.

Recommendation: (a).

---

## B. Security findings (verified in code)

### B1. Token consumption race — `password-reset-service.ts:152`

`findValidToken` (read) → `bcrypt.hash` (~100–300ms) → `$transaction` that
marks used **unconditionally by id**. Two concurrent requests with the same
token both pass validation during the bcrypt window and both consume;
single-use is check-then-act, not atomic.

*Honest exploitability: low* (attacker needs the token, and both writes set
the same password), but single-use is a stated invariant and it is not
enforced.

**Options:**
- **(a) Conditional consume:** inside the transaction,
  `updateMany({ where: { id, usedAt: null }, ... })` and throw if
  `count === 0`. Pro: ~5 lines, truly atomic. Con: none.
- **(b) Interactive transaction with `SELECT … FOR UPDATE`** — Pro:
  textbook. Con: heavier than needed here.

Recommendation: (a).

### B2. Timing-based account enumeration — `forgot-password/route.ts`

Response body is uniform, but for a known email the route **awaits** token
writes + the Resend HTTP call (hundreds of ms) before returning; unknown
emails return fast. Timing reveals which emails have accounts — undermining
the entire "always 200" design.

**Options:**
- **(a) Fire-and-forget the send** (`void sendEmail().catch(log)`): Pro:
  near-uniform timing, faster responses. Con: mailer failure is only in logs
  (already true for the client).
- **(b) Constant-time padding:** Pro: precise. Con: fragile, ugly.

Recommendation: (a). The DB writes still add some skew, but (a) removes the
dominant term.

### B3. No rate limit on `reset-password`, `setup-password`, `invite/[token]`

Middleware explicitly skips `/api/auth/**` from the API limiter, and only
forgot-password self-limits. Brute-forcing tokens is **not** a real threat
(43-char base64url ≈ 256 bits — infeasible regardless), so this is about
bcrypt-cost CPU burn and log spam, not compromise.

**Options:**
- **(a) Include these three in the general API limiter path** (carve the
  exception down to NextAuth's own routes). Pro: reuses existing infra.
  Con: middleware conditional gets hairier.
- **(b) Accept the risk, documented.** Defensible given entropy.

Leaning (a); severity low.

### B4. Login limiter is IP-only

Two consequences: the whole hotel behind one NAT shares a 5-attempt bucket
(staff can lock each other out — support pain), and a distributed attacker
rotating IPs gets 5 attempts *per IP* against one account.

**Options:**
- **(a) Add a per-account dimension** (like forgot-password's dual key). Pro:
  stops distributed stuffing of one account. Con: enables deliberate
  lockout-DoS of a known victim's email — the reason it was originally
  avoided.
- **(b) Keep IP-only + increase window on repeated exhaustion.** Pro: no DoS
  vector. Con: doesn't fix distributed stuffing.

Honest tradeoff: for an internal tool with ~a dozen accounts, (a)'s DoS risk
is nastier than (b)'s gap. Keep IP-only and revisit if this is ever exposed
beyond staff.

### B5. CSP is now `'unsafe-inline'` — deliberate but temporary

The hotfix trades inline-XSS protection for a working app. The proper fix is
per-request **nonce + `strict-dynamic`** in middleware. Pro: real inline
protection restored. Con: our middleware is already custom (withAuth shim,
limiters, body cap) and nonce plumbing through it needs careful testing —
exactly what rushed CSP work got us into. Schedule it; don't rush it.

### B6. What's genuinely solid ✅

- `tokenVersion` **is enforced** (checked against the DB every JWT refresh,
  sessions die on password change) — verified at `auth.ts:113–147`.
- Tokens are 256-bit, stored SHA-256-hashed, never returned in responses.
- Invalid/expired/used tokens are indistinguishable to callers (single
  `NotFoundError` message).
- Audit trail carries no secrets.
- `form-action 'self'` and `frame-ancestors 'none'` are in place.
- Middleware whitelist is minimal and tested (`PUBLIC_AUTH_PATHS` Set).

---

## C. Correctness bugs found

### C1. Email case-sensitivity split-brain (pre-existing, but recovery inherits it)

Login lowercases the input (`auth.ts:60`); forgot-password lowercases via
zod — but **staff creation stores the email as typed** (`staff-mutations.ts:42`,
no normalization in `validations/staff.ts`). A staff member created as
`Jane@…` can **never log in and never reset** — both lookups miss.

**Options:**
- **(a) Normalize at creation + one-time SQL** (`UPDATE "User" SET email =
  lower(email)`) — check for collisions first. Pro: root cause fixed. Con:
  needs the prod SQL-editor dance again.
- **(b) `citext`/functional index** — Pro: bulletproof at the DB. Con:
  migration complexity.

Recommendation: (a).

### C2. `NEXTAUTH_URL` read unguarded in email templates

If unset, reset links render as `undefined/reset-password?…`. Read once in
the service, throw if missing.

### C3. Setup flow is dead code in prod

`issueSetupTokenForUser` has no caller — `/setup-password` is unreachable by
real invites until the staff-creation wiring lands (~40 lines, already scoped
as the deferred follow-up).

### C4. Remember-device checkbox does nothing

Shipped knowingly (option A), but it's now live in prod — a control that
lies. Either wire per-login `maxAge` promptly or remove the checkbox until
it's real.

---

## D. Architecture audit (agent findings, verified)

### Violations worth acting on

1. **forgot-password route does orchestration** (limiter keys, 429 shaping,
   mailer dispatch) — Rule 1 says one service call. Move into
   `requestPasswordReset(email, ip)` in the service. This also *concentrates*
   B2's fix in one place.
2. **`src/lib/email/` is architecturally homeless** — side-effecting
   infrastructure outside `services/`. Either move to
   `services/email-service.ts` or amend Rule 2 with an explicit exception.
   *Resolved 2026-08-10 via Rule 2 amendment (issue #147): infrastructure
   adapters are documented as legitimate `src/lib/<name>/` peers of
   `services/`. `transport.ts` renamed to `email-transport.ts` to match
   the codified `<name>-transport.ts` convention.*
3. **The five auth hooks hand-roll `fetch`/`isLoading` with zero
   `// claude-allow: rule-5` markers** — the decision was approved *in
   conversation*, but the source tree has no trace, so every future audit
   re-flags it. Add markers citing the decision.
4. **Test gaps:** no tests for `src/lib/email/**`, `validations/auth-token.ts`,
   or `use-auth.ts`. (The agent also claimed `use-login-form` was untested —
   verified false, it has 9 tests including the lockout branch.)

### Smells (bundle into one cleanup pass)

- Duplicated `inputClasses` string ×4 pages.
- Near-identical reset/setup hooks (extract `useTokenPasswordForm`).
- Duplicated eye-toggle JSX and expired-screen components.
- Raw hex `#c9baa0`/`#4a5d78` bypassing tokens.
- Native checkbox on login instead of shadcn `Checkbox`.
- Wire types (`LoginRateLimitStatus`, inline api-input literals) not sourced
  from their canonical homes.
- `rate-limit-service`'s three copy-pasted factories.

---

## Recommended attack order

| Priority | Items | Size |
|---|---|---|
| 1 — security correctness | B1 atomic consume · B2 fire-and-forget send · A2 `method="post"` · A3 fail-fast transport | ~1 small branch |
| 2 — correctness | C1 email normalization (+ prod SQL) · C2 env guard | 1 branch |
| 3 — architecture debt | D1 route→service move · D2 email home · D3 markers · D4 tests | 1 branch |
| 4 — product honesty | C3 invite wiring · C4 remember-device (wire or remove) | 1 branch each |
| 5 — scheduled | B5 nonce CSP · A1(b) Playwright smoke | when CI returns |
