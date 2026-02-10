# ADR-001: MVP Scope — CLI-Based Deal Scanner

## Status
Accepted

## Context
We want to build a production-grade agentic system for finding bargain vintage analog synthesizers. The full vision includes a web UI, database, notifications, scheduled runs, and multiple marketplace integrations. However, we want to drive out the core development loop as fast as possible with a thin vertical slice, learning agentic patterns, eval practices, and modern tooling along the way.

## Decision
The MVP is a **CLI-invokable agent** that:

1. Reads a watchlist of synth models from a JSON config file.
2. Fetches current listings from Reverb for each model.
3. Fetches recent sold listings from Reverb for price context.
4. Normalizes listing data using an LLM.
5. Scores each listing as a deal (or not) using an LLM with price context.
6. Writes a human-readable deal report to a log file.

Invoked via: `npm run scan`

**Explicitly deferred:**
- Web frontend
- Database / persistent storage
- Scheduled/periodic execution
- Push notifications or email alerts
- Multiple marketplace support (abstraction is in place, but only Reverb is implemented)

## Consequences
- We get end-to-end value quickly with no infrastructure dependencies.
- Every interesting architectural component (marketplace abstraction, LLM pipeline, evals) is exercised.
- The system is useful immediately — you can run it manually whenever you want to check for deals.
- Adding persistence, UI, and scheduling later will change where data flows, not how the core logic works.
