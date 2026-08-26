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
- Vulnerabilities in third-party dependencies (report those upstream; Dependabot handles security updates here)
- Issues that require physical access, an already-compromised account, or social engineering of the maintainer
- Missing best-practice headers on non-production preview deployments
- Rate-limit bypasses that require distributed infrastructure the average attacker doesn't have

## Known accepted risk

`npm audit --omit=dev` currently reports 3 high-severity alerts, all the same
root cause: `deepmerge-ts <8.0.0` (stack exhaustion on recursive object
graphs), pulled in transitively via `prisma` → `@prisma/config`. The only fix
path is a Prisma downgrade to 6.12.0, which was deliberately not taken. Risk
is accepted because `prisma` is a build-time CLI dependency (used by
`vercel-build` for `prisma migrate deploy`), not code in the request path —
there's no way for an untrusted input to reach it. Will re-enable the check
once Prisma publishes a patched 7.x release. See the dismissal reasoning on
the corresponding Dependabot alert and commit `4b992e2`.

## No bounty

This is a portfolio project. There is no bug bounty, no swag, and no financial reward. Contributors will be credited in the security advisory unless they prefer to remain anonymous.
