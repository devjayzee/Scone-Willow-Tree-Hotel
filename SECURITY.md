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

## No bounty

This is a portfolio project. There is no bug bounty, no swag, and no financial reward. Contributors will be credited in the security advisory unless they prefer to remain anonymous.
