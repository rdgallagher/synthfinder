# ADR-005: Tech Stack Choices

## Status
Accepted

## Context
We need to choose a language, runtime, and framework stack. The developer has experience with JavaScript, TypeScript, React, Angular, and Node/Express, but hasn't used Next.js. One project goal is to get current with modern web development practices.

## Decision

| Layer | Choice | Rationale |
|-------|--------|-----------|
| Language | TypeScript (strict mode) | Type safety for the marketplace abstraction and LLM output schemas. Already familiar. |
| Runtime | Node.js (latest LTS) | Familiar, good ecosystem for API clients and LLM SDKs. |
| Framework | Next.js (App Router) | Deferred to post-MVP for the web UI, but we'll set up the project structure to accommodate it. Learning goal. |
| LLM SDK | Anthropic SDK (`@anthropic-ai/sdk`) | Direct access to Claude for normalization and scoring. |
| Testing | Vitest | Fast, TypeScript-native, good DX. Compatible with the project's module setup. |
| Package manager | npm | Simple, universal. No strong reason for pnpm/yarn given project size. |
| Linting | ESLint + Prettier | Standard. Enforced in CI. |

**MVP-specific:** The MVP is a pure Node.js/TypeScript project. Next.js is introduced when we add the web UI. This avoids framework overhead during the CLI-only phase.

## Consequences
- Familiar language reduces friction; the learning is focused on agentic patterns, not syntax.
- TypeScript strict mode catches bugs early, especially around LLM output parsing.
- Starting without Next.js keeps the MVP lean; adding it later means restructuring the project, but the core logic in `src/` will be framework-agnostic.
- Vitest over Jest is a minor bet on the newer tool, but it's fast and handles TypeScript natively without extra config.
