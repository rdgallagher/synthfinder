# ADR-003: Two-Stage LLM Pipeline (Normalizer + Scorer)

## Status
Superseded by [ADR-011](./011-collapse-two-stage-pipeline.md)

## Context
Raw marketplace listings are messy and inconsistent. "Roland JUNO 106 great cond w/ case" needs to become structured data before we can reason about it. We also need an LLM to make the subjective judgment of whether a listing is a good deal given price context. These are two distinct tasks with different evaluation criteria.

## Decision
Split LLM usage into two independent stages:

1. **Normalizer**: Takes a raw listing (title, description, price, seller info) and extracts structured data:
   - Canonical synth model name
   - Condition tier (mint / excellent / good / fair / poor / for parts)
   - Price
   - Notable extras (case, modifications, missing parts)
   - Red flags (no power cable, "as-is", etc.)

2. **Scorer**: Takes a normalized listing + an array of recent sold prices (with conditions) and produces:
   - A deal score (e.g., 1–10 or a tier: strong bargain / fair deal / overpriced)
   - Human-readable reasoning ("This Juno-106 in good condition is listed at $800. Similar units in good condition have sold for $1,100–$1,400 in the last 90 days. This is a strong bargain.")

Each stage has its own prompt, own output schema, and own eval suite.

## Consequences
- Each LLM component can be evaluated, debugged, and improved independently.
- The normalizer can be reused for other purposes (e.g., building a price database).
- The scorer's eval can hold the normalizer constant by using pre-normalized fixtures.
- Two LLM calls per listing increases latency and cost, but these are background batch operations where that doesn't matter.
- Clear contract between stages makes it possible to swap in a fine-tuned model or heuristic for either stage later.
