# ADR-005: Tech Stack Choices

## Status
Accepted (updated)

## Context
We need to choose a language, runtime, and framework stack. The developer has experience with JavaScript, TypeScript, React, Angular, and Node/Express, but hasn't used Next.js. One project goal is to get current with modern web development practices.

## Decision

| Layer | Choice | Rationale |
|-------|--------|-----------|
| Language | TypeScript (strict mode) | Type safety for the marketplace abstraction and LLM output schemas. Already familiar. |
| Runtime | Node.js (latest LTS) | Familiar, good ecosystem for API clients and LLM SDKs. |
| Framework | Next.js (App Router) | Included from day one as the project shell. The agent package is a Next.js App Router project; core logic in `src/lib/` is framework-agnostic. Learning goal. |
| LLM SDK | Anthropic SDK (`@anthropic-ai/sdk`) | Direct access to Claude for normalization and scoring. |
| Testing | Vitest | Fast, TypeScript-native, good DX. Compatible with the project's module setup. |
| Package manager | npm | Simple, universal. No strong reason for pnpm/yarn given project size. |
| Linting | ESLint + Prettier | Standard. Enforced in CI. |

**MVP-specific:** The MVP is a Next.js project from the start, but the web UI routes come after the CLI scan works. Core agent logic lives in `src/lib/` and is framework-agnostic, so the CLI and web UI share the same codebase.

## Consequences
- Familiar language reduces friction; the learning is focused on agentic patterns, not syntax.
- TypeScript strict mode catches bugs early, especially around LLM output parsing.
- Starting with Next.js from day one means learning the framework early, but core logic in `src/lib/` remains portable and framework-agnostic.
- Vitest over Jest is a minor bet on the newer tool, but it's fast and handles TypeScript natively without extra config.
