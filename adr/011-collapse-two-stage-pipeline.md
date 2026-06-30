# ADR-011: Collapse the Two-Stage Pipeline into a Single Analyzer

## Status
Accepted (supersedes [ADR-003](./003-llm-pipeline.md))

## Context

ADR-003 split LLM usage into two independent stages — a **normalizer** (raw listing →
structured data) and a **scorer** (normalized listing + sold comps → deal score) — each
with its own prompt, output schema, and eval suite. The orchestrator (`scan.ts`) injected
`normalize` and `score` as dependencies and chained them once per listing.

In practice the two-stage shape cost more than it returned:

- **Cost and latency scaled badly.** Two LLM calls per listing meant ~100 calls and ~92k
  tokens for a 50-listing scan.
- **The split lost cross-listing context.** Scoring each listing in isolation gave the
  model no view of the other listings in the same scan to calibrate against.

Commit RDG-11 replaced both stages with a single `analyzeListings` call that sends all
listings and all sold comps at once, normalizing and scoring in one pass. This cut the
50-listing scan to **1 call and ~15k tokens**, and let the model **see all listings
simultaneously for better relative calibration**. ADR-010 (synth-specific knowledge via
the Anthropic Skills API) was subsequently built on `analyzeListings` only.

The original `normalizer.ts` and `scorer.ts` modules were left in the tree after RDG-11.
They became **shadow modules** — reachable only from their own eval suites — and their
prompt/schema/stub logic diverged from the combined analyzer that actually ships. Their
evals measured code paths production no longer ran. In particular, the scorer eval fed
*pre-normalized* input to isolate scoring from normalization — a calling convention the
system had abandoned.

## Decision

Make `analyzeListings` (`packages/agent/src/lib/analyzer.ts`) the single analysis module:
raw `Listing[]` + `SoldListing[]` → `ScoredListing[]`, normalizing and scoring in one LLM
call for the whole batch.

- **Delete** `normalizer.ts` (`normalize`) and `scorer.ts` (`score`), along with their
  unit tests and the `evals/normalizer/` and `evals/scorer/` suites.
- **Extract** the still-shared, pure `computePriceStats` (and its `PriceStats` type) into
  `packages/agent/src/lib/price-stats.ts`, with its own unit tests. The analyzer imports
  it from there.
- **Fold** the two eval suites into a single `evals/analyzer/` suite that drives
  `analyzeListings` and asserts on the whole `ScoredListing` — normalized fields and deal
  tier — using per-case partial expectations.

## Consequences

- **One analysis interface is also the eval surface.** The path that ships is the path the
  evals measure; behaviour changes have one place to live.
- **Independent evaluability of normalization vs. scoring is given up.** The analyzer has
  no seam to inject a fixed normalization, so a case that asserts a deal tier now exercises
  normalization jointly. This was the headline benefit of ADR-003, and it is the explicit
  cost of the collapse — judged worthwhile because the combined call is what production
  runs and what ADR-010 extends.
- **Stub mode is no longer duplicated three ways.** Only the analyzer's stub remains. (A
  follow-up may lift it to an in-memory adapter at the existing
  `ScanDependencies.analyzeListings` seam.)
- The normalizer's reusability for other purposes (e.g. a price database), noted as a
  benefit in ADR-003, is no longer available without re-introducing a dedicated module.
