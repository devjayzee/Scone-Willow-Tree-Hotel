# Security Policy

## Supported versions

Only the current `main` branch is supported. This is a portfolio project maintained by a single developer; there are no long-term support releases.

## Reporting a vulnerability

**Do not open a public GitHub issue for security reports.**

Preferred: [open a private security advisory](https://github.com/devjayzee/Scone-Willow-Tree-Hotel/security/advisories/new) directly on the repository. This creates a private thread with the maintainer and lets a fix be prepared before public disclosure.

Fallback: email `jeromedzarate@gmail.com` with `[SECURITY]` in the subject line.

Please include:
- A description of the vulnerability
- Steps to reproduce (or a proof-of-concept)
- The affected file, endpoint, or commit hash if you have it
- Your assessment of the impact

## Response commitment

Best-effort, single-maintainer:
- Acknowledgement within 5 business days
- Triage assessment within 14 business days
- Fix + coordinated disclosure timeline for confirmed vulnerabilities

If you don't hear back within 5 business days, please follow up on the same thread.

## Scope

In scope:
- The application code under `src/` and `prisma/`
- The CI workflow under `.github/workflows/`
- Documented architecture rules under `.claude/rules/`

Out of scope:
- Vulnerabilities in third-party dependencies (report those upstream; alerts are triaged manually, see below)
- Issues that require physical access, an already-compromised account, or social engineering of the maintainer
- Missing best-practice headers on non-production preview deployments
- Rate-limit bypasses that require distributed infrastructure the average attacker doesn't have

## Dependency alert triage

Dependabot security updates are off; alerts stay on and are handled manually.

- **Weekly triage:** every Monday, after Dependabot's 09:00 Australia/Sydney
  run, list open alerts with
  `gh api --paginate "repos/devjayzee/Scone-Willow-Tree-Hotel/dependabot/alerts?state=open&per_page=100" --jq '.[] | "\(.number) \(.security_advisory.severity) \(.dependency.scope) \(.dependency.package.name)"'`.
  Every alert must be fixed, in an open fix PR, merged to `development`
  awaiting release, or dismissed with a reason and a comment.
- **Deadlines**, measured as "fix merged to `main`":
  - Critical or high and reachable in production (request path, server
    bundle or client bundle): a `hotfix/*` within 72 hours.
  - Critical or high labelled runtime but not reachable (build CLI, unused
    code path): `development` within 7 days and `main` within 14.
  - Medium or low runtime, and all dev-only: within 30 days.
  - Deadlines run from alert creation, or from 2026-10-06 for alerts already
    open when this policy was adopted.

## Known accepted risk

**deepmerge-ts.** `deepmerge-ts <8.0.0` (stack exhaustion on recursive object
graphs), pulled in transitively via `prisma` → `@prisma/config`. The only fix
path is a Prisma downgrade to 6.19.3, which was deliberately not taken. Risk
is accepted because `prisma` is a build-time CLI dependency (used by
`vercel-build` for `prisma migrate deploy`), not code in the request path —
there's no way for an untrusted input to reach it. Will re-enable the check
once Prisma publishes a patched 7.x release. See the dismissal reasoning on
the corresponding Dependabot alert and commit `4b992e2`.

**mysql2.** Reaches us only through the `prisma` CLI, which pins `mysql2`
3.15.3 exactly in 7.9.1 and 7.10.0. The CLI loads it only through Prisma
Studio's MySQL executor, as a dynamic `import("mysql2/promise")` in
`node_modules/prisma/build/cli.js`. Our datasource is `postgresql`
(`prisma/schema.prisma:8`), so mysql2 is never loaded. The app uses Postgres
via `@prisma/adapter-pg` and never opens a MySQL connection. It is not overridden
or force-fixed, because that CLI runs migrations against production. Alerts
#161 and #164 are dismissed as `tolerable_risk`.

The accepted Prisma-chain items (deepmerge-ts, mysql2) stay in
`npm audit --omit=dev` output and show as dismissed alerts on GitHub,
re-checked on each Prisma release.

## No bounty

This is a portfolio project. There is no bug bounty, no swag, and no financial reward. Contributors will be credited in the security advisory unless they prefer to remain anonymous.
