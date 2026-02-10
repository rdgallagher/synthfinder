# ADR-004: Evals as First-Class Citizens

## Status
Accepted

## Context
This project is both a real tool and a learning exercise in building production-grade agentic systems. LLM-powered components are non-deterministic — the same input can produce different outputs across runs. Traditional unit tests alone are insufficient. We need an evaluation framework that can measure quality over time and catch regressions.

## Decision
Every LLM-powered component gets a corresponding eval suite from the start:

**Structure:**
```
evals/
  normalizer/
    cases.json        # Array of { input: RawListing, expected: NormalizedListing }
    eval.ts           # Runner: calls normalizer on each case, scores results
  scorer/
    cases.json        # Array of { input: { listing, soldPrices }, expected: { minScore, maxScore } }
    eval.ts           # Runner: calls scorer on each case, checks score in range
  fixtures/
    reverb-responses/ # Saved API responses for deterministic inputs
```

**Eval types:**
- **Normalizer evals**: Field-level accuracy — did it get the model name right? The condition? Scored as percentage of fields correct across the dataset.
- **Scorer evals**: Range-based — given this listing and these comps, is the score within an acceptable range? Plus qualitative checks on reasoning.

**Running evals:**
- `npm run eval:normalizer` and `npm run eval:scorer` run independently.
- Evals output a summary: pass rate, failures with diffs, overall score.
- Evals run in CI on every push, but with a threshold (e.g., >85% pass rate) rather than requiring 100%, to accommodate LLM non-determinism.

**Building the dataset:**
- Start with 10–15 hand-labeled cases per component, built from real Reverb listings.
- Grow the dataset over time, especially when we find failure cases in practice.

## Consequences
- Quality is measurable and trackable from day one.
- Prompt changes can be validated against the eval suite before merging.
- CI provides a safety net — regressions in LLM behavior are caught automatically.
- Maintaining eval datasets is ongoing work, but it's the only way to have confidence in a non-deterministic system.
- The eval threshold in CI needs tuning — too strict and flaky runs block merges, too loose and regressions slip through.
