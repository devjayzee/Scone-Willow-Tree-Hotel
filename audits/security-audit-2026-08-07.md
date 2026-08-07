# Security Audit — 2026-08-07

Scope: `src/` (all API routes + auth infra + services + middleware) and
top-level config (`next.config.ts`, `package.json`, `.env.example`,
`.gitignore`). Read-only against the 14-item checklist below. Prior fixes
(#64–#73, #90) verified in place; findings list only what remains open.

## 1. Authorization on every request — Warn

Every handler under `src/app/api/**/route.ts` calls `getServerSession` (11/11
files; verified via Rule 4 in the 2026-08-05 architecture audit, unchanged).
Role gates enforced inline in staffs (`src/app/api/staffs/route.ts:20`,
`src/app/api/staffs/[id]/route.ts:27,51,82`), rooms mutations
(`src/app/api/rooms/route.ts:35`, `src/app/api/rooms/[id]/route.ts:42,72`),
booking delete (`src/app/api/bookings/[id]/route.ts:119`), and reports
(`src/app/api/reports/route.ts:23-28`).

**Gap — no per-resource ownership check on bookings.** `getBookingById`
(`src/lib/services/booking/booking-queries.ts:37-48`) returns any booking to
any authenticated user; the route (`src/app/api/bookings/[id]/route.ts:26-34`)
only checks `session?.user`. Same for `PUT`/`PATCH` at lines 46-105 — any
STAFF can read or edit any booking (including changing status or cancelling)
regardless of `createdById`. `deleteBooking` is gated to `GENERAL_MANAGER`
but everything else is wide open across the staff population. If the intent
is "all staff can service any guest," mark this Info; if not, this is
**High**. Fix: decide the model, then either add a comment documenting the
shared-tenancy design or add `assertCanAccessBooking(session, booking)` in
the service.

Everything else (calendar, reports, rooms reads, rooms/available) is fine
for a single-tenant app — no per-resource ownership concept exists in
`Room` / `Calendar`.

## 2. Authentication & sessions — OK

- bcrypt cost 12 with rehash-on-login (`src/lib/auth.ts:93-99`,
  `src/lib/constants/auth.ts:8`) — #71 shipped.
- Timing-equalized authorize (`src/lib/auth.ts:74-77` uses `DUMMY_PASSWORD_HASH`
  at matching cost) — #66 shipped.
- Boot-time `NEXTAUTH_SECRET` assertion (`src/lib/auth.ts:10-12`) — #70 shipped.
- JWT strategy, `maxAge` 12h, `updateAge` 1h (`src/lib/auth.ts:161-169`) — #67 shipped.
- `tokenVersion` invalidation on password change (`src/lib/auth.ts:113-141`,
  `src/lib/services/staff/staff-mutations.ts:126-129`) — cuts sessions when
  admin resets or user changes their password.
- Cookies: no custom `cookies` block in `authOptions`, so NextAuth defaults
  apply — `__Secure-next-auth.session-token` with `httpOnly`, `Secure`,
  `SameSite=Lax` under HTTPS. Acceptable.

No password-reset flow exists (Info — out of scope per instructions; single
GM-managed team).

## 3. Rate limiting — Warn

- IP-keyed login limiter (5/15m) in `src/middleware.ts:12-33` +
  `src/lib/services/rate-limit-service.ts:26-31`, safe IP extraction in
  `src/lib/utils/get-client-ip.ts:19-37` — #68/#90/#82 shipped.
- Per-email limiter (10/15m) in `src/lib/auth.ts:19-37` — #90.
- Both use Upstash Redis so multi-instance safe.

**Gap — no rate limit on any non-auth API route.** Every other handler
(`/api/bookings`, `/api/staffs`, `/api/rooms`, `/api/calendar`,
`/api/reports`) is unlimited per authenticated user. A compromised or
malicious STAFF token can enumerate/exhaust at will. **Medium.** Fix: add a
per-user + per-route limiter in `middleware.ts` for `/api/*` (e.g. 120/min).

**Gap — no request body size cap.** Route handlers call `request.json()`
directly (e.g. `src/app/api/bookings/route.ts:49`,
`src/app/api/staffs/route.ts:43`) with no size guard. Zod field caps limit
individual fields, but a 100 MB body still gets parsed before validation.
**Low.** Fix: cap `Content-Length` in middleware (`> 100 KB → 413`).

## 4. Input validation & injection — OK

Every route parses inputs through zod schemas in `src/lib/validations/`
before calling a service (verified across all 11 route files). Prisma
parameterizes queries by construction — zero `$queryRaw` / `$executeRaw`
callers. Zero `exec()` / `spawn()` / `child_process` usage. No filesystem
reads/writes take user input (no `readFile`/`writeFile` calls anywhere in
`src/`). No file uploads exist (see item 12).

## 5. CRLF injection — OK

- No user input reaches `Set-Cookie`, `Content-Disposition`, or
  `Location` headers. Redirects (`src/middleware.ts:46,53,61`,
  `src/app/page.tsx:4`) use hard-coded paths (`/bookings`, `/login`) —
  no user-controlled target. `NEXTAUTH_URL` is used by NextAuth internally.
- `logger.ts:37` serializes context via `JSON.stringify`, which escapes
  newlines. Error branches (`logger.ts:81`) stringify `error.name` /
  `error.message` inside the same JSON envelope. Log-injection surface is
  minimal — user-controlled strings never bypass JSON.stringify.

## 6. XSS — OK / Warn

- Zero `dangerouslySetInnerHTML` in `src/`. No markdown or HTML rendering.
  React auto-escapes everything.
- No DOMPurify (not needed given the above).
- **No Content-Security-Policy header.** `next.config.ts:3-5` is empty
  (`{}`). Absent CSP is defence-in-depth loss, not an active bug. **Low.**
  Fix: add a `headers()` block with a restrictive CSP; see item 8.

## 7. CSRF — OK

NextAuth session cookie defaults to `SameSite=Lax`; state-changing routes
require the cookie so cross-origin form posts don't carry credentials.
NextAuth's own `/api/auth/*` endpoints use the built-in CSRF-token flow.
No GET handlers mutate state (all POST/PUT/PATCH/DELETE). No custom
cookie-auth API bypassing NextAuth.

## 8. Security headers — Fail

`next.config.ts:1-7` has no `headers()` block. Server sends none of:
`Strict-Transport-Security`, `Content-Security-Policy`,
`X-Content-Type-Options: nosniff`, `X-Frame-Options`/`frame-ancestors`,
`Referrer-Policy`, `Permissions-Policy`. `X-Powered-By` also not removed
(`poweredByHeader: false`). **Medium.** Fix: add a `headers()` config
returning at minimum HSTS (`max-age=63072000; includeSubDomains; preload`),
`X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`,
`Referrer-Policy: strict-origin-when-cross-origin`, and set
`poweredByHeader: false`.

## 9. Secrets — OK

- `.env*` covered by `.gitignore:29` (`.env*` glob).
- `.env.example` uses placeholder strings only
  (`.env.example:11,16,21,26,27`) — no real values.
- Zero `NEXT_PUBLIC_*` references anywhere in the repo. Nothing exposed to
  the client bundle.
- Zero hardcoded credentials in `src/` other than `DUMMY_PASSWORD_HASH`
  (`src/lib/constants/auth.ts:17-18`), which is intentional and public by
  design (see file docstring).
- No `process.env` dumps in logging (`src/lib/logger.ts` never touches
  `process.env` beyond `NODE_ENV`).

## 10. CORS — OK

No CORS configuration exists (grep for `Access-Control-Allow` in
`*.{ts,tsx,mjs,js}` returns zero hits). Next.js default = same-origin only.
Correct for a first-party dashboard.

## 11. SSRF & open redirects — OK

- Zero server-side `fetch()` calls in `src/lib/services/**` (verified).
- Every `NextResponse.redirect` and `router.push` uses a hard-coded path
  (`src/middleware.ts:46,53,61`, `src/hooks/use-login-form.ts:43`,
  `src/components/layout/header.tsx:91`,
  `src/components/layout/dashboard-shell.tsx:16`).
- `signIn`/`signOut` calls pass fixed `callbackUrl: "/login"`. NextAuth
  validates callback URLs against `NEXTAUTH_URL`.

## 12. File uploads — N/A

No `multipart/form-data`, `formData()`, or upload endpoints. `formData` grep
hits are React `useState`-object identifiers in staff dialog, not the DOM
API.

## 13. Dependencies — OK

- `package-lock.json` committed (present in repo root, referenced by lockfile
  grep).
- `next@16.1.6` (`package.json:31`, lockfile confirms) — well past the
  15.2.3 CVE-2025-29927 middleware-bypass patch line. Not vulnerable.
- `next-auth@4.24.13`, `bcryptjs@3.0.3`, `@upstash/ratelimit@2.0.8`,
  `zod@4.3.6`, `prisma@7.4.1` — all recent majors. No `overrides` block.
- `npm audit` not executed per instructions; run it separately.

## 14. Errors & logging — OK / Warn

- `handleApiError` (`src/lib/api-error-handler.ts:41-91`) returns
  `{ error, code, details? }` only. Stack traces / `error.message` for
  unknown errors are stripped — client gets a generic `Failed <verb>ing
  <thing>` (line 84-90); the raw error goes to `logger.error` server-side
  (line 81). Correct.
- `logger.error` writes `error.name`, `error.message`, `stack` to server
  stdout (`src/lib/logger.ts:73-82`). No client leak.
- `sanitizeForAudit` (`src/lib/services/audit-service.ts:166-179`) strips
  `password`/`token`/`secret` before persisting audit entries. All call
  sites for password-adjacent audits use it.
- No Sentry / observability integration wired up (Info — logger has the
  hook comment on line 4 but nothing installed).

**Gap — `AuditDetails.ipAddress` and `.userAgent`
(`src/lib/services/audit-service.ts:57,59`) are declared but zero call
sites populate them.** Audit entries lack per-request forensic context.
**Low.** Fix: plumb `req.headers` into audit calls at route boundaries.

## Summary

Severity counts:
- **Critical:** 0
- **High:** 0-1 (item 1 booking ownership — High if per-user tenancy is
  intended, Info if intentional shared-team model)
- **Medium:** 3 (item 3 non-auth rate limits, item 3 body size cap, item 8
  security headers)
- **Low:** 3 (item 6 CSP absent — subset of item 8; item 14 audit
  ip/userAgent; item 3 body size cap — see above)
- **Info:** 2 (no password-reset flow, no Sentry)

### Top 5 to prioritize

1. **Confirm booking-access model** (`src/app/api/bookings/[id]/route.ts:26-34,46,68,108`) — either document "all staff share bookings" or add an ownership assertion in `getBookingById` / `updateBooking`.
2. **Add security headers** (`next.config.ts:3-5`) — one `headers()` block for HSTS + nosniff + frame-ancestors + Referrer-Policy + CSP; also flip `poweredByHeader: false`.
3. **Rate-limit non-auth `/api/*` routes** (`src/middleware.ts:8-36`) — reuse `getLoginRateLimiter` pattern with a per-token+path key at ~120 req/min.
4. **Request body size cap in middleware** (`src/middleware.ts:83-96`) — reject `Content-Length > 100_000` with 413 before it reaches `request.json()`.
5. **Populate audit `ipAddress` / `userAgent`** (`src/lib/services/audit-service.ts:57,59`) — thread `getClientIp(req)` + `req.headers.get("user-agent")` from each route through to `createAuditLog`.

### Beyond the checklist

- **PII in DB is unencrypted at rest at the app layer.** Bookings store
  guest name, DOB, address, phone, email, vehicle rego
  (`src/lib/services/booking/booking-mutations.ts:68-90`,
  `src/lib/validations/booking.ts:56-90`). This is fine if the Postgres
  volume is encrypted (Vercel/Supabase/Neon defaults do this), but there is
  no field-level encryption or key rotation. Note only — not a bug.
- **`generatePassword` uses `Math.random`** (`src/lib/validations/password.ts:142-155`).
  Only used as a UI convenience for admins creating staff accounts (they
  can see the generated value in the form). Not cryptographically strong,
  but the generated password is immediately visible to the admin and can
  be rotated, so risk is bounded. **Low.** Fix: switch to
  `crypto.getRandomValues` for hygiene.
- **`logger` writes to `console.*` only.** No log shipping, no PII
  redaction beyond `sanitizeForAudit` in audit paths. Route-level
  `handleApiError` calls `logger.error("Unexpected API error", error,
  { context })` — the context string is developer-authored, so no PII
  leak, but production logs on Vercel are only queryable via the
  dashboard. Info.
