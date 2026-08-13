# Self-hosted GitHub Actions runners

Local Docker-based CI runners for this repo. Used during the private-repo
phase to save GitHub-hosted Actions minutes. Flip back to hosted (unlimited
on public repos) by deleting the `RUNNER` repo variable — see "Flip back
to hosted" below.

## When to use these

- **Yes:** repo is private, you're the only contributor, you want to save
  free-tier Actions minutes.
- **No:** repo is public (hosted is unlimited and safer against fork PRs),
  or you have external collaborators (they can execute arbitrary code on
  your Mac via workflow edits).

## Prerequisites

1. **Docker Desktop** installed and running.
2. **Docker Desktop memory ≥ 8GB** — Settings → Resources → Memory slider.
   Playwright + Next build + 2 concurrent runners can peak around 6-7GB;
   under 8GB risks OOM kills mid-job.
3. A **fine-grained Personal Access Token** (see `.env.example` for the
   exact permissions).

## Initial setup

```bash
# 1. Create your local env file
cp .github/runner/.env.example .github/runner/.env
# 2. Edit .github/runner/.env → paste the PAT
# 3. Start the runners (2 replicas)
docker compose -f .github/runner/docker-compose.yml --env-file .github/runner/.env up -d
# 4. Verify runners are online
#    GitHub → Settings → Actions → Runners
#    Should show 2 runners named `swth-mac-<random>` with status "Idle"
```

Then flip the switch — GitHub → **Settings → Secrets and variables →
Actions → Variables** → New repository variable:

- Name: `RUNNER`
- Value: `self-hosted`

The next workflow run dispatches to your local runners.

## Daily operations

```bash
# Check runner containers are running
docker compose -f .github/runner/docker-compose.yml ps

# Follow logs (useful when debugging why a job didn't dispatch)
docker compose -f .github/runner/docker-compose.yml logs -f

# Stop everything (runners deregister automatically on shutdown)
docker compose -f .github/runner/docker-compose.yml down

# Restart after Docker Desktop reboot / Mac restart
docker compose -f .github/runner/docker-compose.yml --env-file .github/runner/.env up -d
```

Ephemeral mode means each runner container exits after one job and is
recreated by Docker. `docker ps` may briefly show 0 or 1 containers
between jobs — this is normal. `docker compose ps` counts replicas
against the desired count.

## Flip back to hosted (temporary or permanent)

Zero code change needed:

- **Temporary** (e.g., Mac is down): GitHub → Settings → Actions →
  Variables → delete `RUNNER`. All future workflow runs dispatch to
  `ubuntu-latest` per the fallback in `.github/workflows/test.yml`.
- **Permanent** (public flip, ending self-hosted phase):
  1. Delete the `RUNNER` variable.
  2. `docker compose down` to stop containers.
  3. GitHub → Settings → Actions → Runners → remove the registered
     runners.
  4. Optional: delete this `.github/runner/` folder and revoke the PAT.

## Troubleshooting

**Job stays in "queued" state indefinitely.**
Runners are offline. Check:
1. `docker compose ps` — are the containers up?
2. GitHub → Settings → Actions → Runners — do they show as online?
3. `docker compose logs` — any auth errors (expired PAT)?

Immediate unblock: delete the `RUNNER` variable → re-run the failed jobs.

**"Killed" or out-of-memory errors mid-job.**
Docker Desktop's memory allocation is too low. Bump to 8GB minimum
(Settings → Resources → Memory), then `docker compose restart`.

**Runners disappear from the Runners page.**
Ephemeral runners deregister after each job — that's expected. Docker
recreates them within seconds (visible in `docker compose ps`). If they
stay gone, check logs for PAT / network errors.

**PAT expired.**
Fine-grained PATs expire (default 90 days). Regenerate, update
`.github/runner/.env`, then `docker compose up -d` (picks up the new env).

## Concurrency

Two replicas by default = two jobs run in parallel on your Mac. This
workflow has four parallel jobs (lint, typecheck, test, smoke) so
worst-case wall time is roughly the sum of the two slowest.

To bump to four (matches GitHub-hosted parity):

1. Edit `docker-compose.yml` → `replicas: 4`.
2. Ensure Docker Desktop has ≥ 12GB RAM allocated.
3. `docker compose up -d --scale runner=4` or just `docker compose up -d`.

## Security notes

- **Fine-grained PAT is required** — not classic PAT with `repo` scope.
  Classic PAT overprivileges the runner (full repo access when it only
  needs `Administration: write`).
- **`.env` is git-ignored** via the root `.gitignore` (`.env*` pattern).
  Never commit it.
- **Fork PRs never dispatch here.** Forks can't read repo variables, so
  the `runs-on: ${{ vars.RUNNER || 'ubuntu-latest' }}` fallback routes
  their PRs to hosted runners. Self-hosted is never exposed to untrusted
  fork code.
- **Solo-repo assumption.** If you add collaborators with write access,
  reconsider self-hosted — any collaborator can execute code on your Mac
  via a workflow file edit. Options: revoke self-hosted, move to a VPS,
  or restrict via GitHub's first-time-contributor approval settings.
