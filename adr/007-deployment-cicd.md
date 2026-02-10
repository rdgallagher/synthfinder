# ADR-007: Deployment and CI/CD

## Status
Accepted

## Context
We want a professional development workflow from the start: version control, automated testing, and a path to deployment. The MVP runs locally as a CLI tool, but we want CI in place early so that tests and evals gate every change.

## Decision

**Version control:** GitHub (public or private repo).

**CI/CD:** GitHub Actions with the following pipeline:

```
on: [push, pull_request]

jobs:
  quality:
    - Install dependencies
    - Lint (ESLint + Prettier check)
    - Type check (tsc --noEmit)
    - Unit tests (vitest)
    - Evals (with threshold-based pass/fail)
```

**Eval handling in CI:**
- Evals that call the LLM run against the Anthropic API using a secret (`ANTHROPIC_API_KEY`) stored in GitHub.
- Eval pass threshold is configured (e.g., 85%) — CI fails if quality drops below it.
- For cost control, evals run on the smallest effective model (e.g., Haiku) unless full-model accuracy is being validated.

**Deployment (post-MVP):**
- When the web UI is added, deploy to Vercel (free tier, native Next.js support).
- The background scan agent could run as a Vercel Cron Job or a GitHub Actions scheduled workflow.
- Environment variables (API keys) managed through the hosting platform's secrets.

**Local development:**
- `npm run dev` — not needed in MVP (CLI tool), but reserved for the future web server.
- `npm run scan` — run the deal scanner.
- `npm test` — run unit tests.
- `npm run eval` — run all evals.
- `npm run lint` — lint and format check.

## Consequences
- Every push is validated automatically — no manual "did I break something?" checks.
- Evals in CI mean LLM quality regressions are caught before merge.
- Running evals in CI costs money (LLM API calls), but the dataset is small and Haiku is cheap.
- GitHub Actions free tier (2,000 minutes/month for private repos, unlimited for public) is more than sufficient.
- Vercel free tier will work for the web UI when we get there (subject to usage limits).
