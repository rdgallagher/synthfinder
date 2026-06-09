# ADR-010: Anthropic Skills for Synth-Specific Knowledge Injection

## Status
Accepted

## Context

The `analyzeListings` LLM call scores listings purely on price vs. sold comps. It has no awareness of synth-specific context that significantly affects value judgements:

- Known failure modes (e.g. Roland Juno-106 voice chips fail frequently but are cheaply repairable)
- Desirable modifications (e.g. Europa MIDI retrofit on a Jupiter-6 adds $300–500 of value)
- Variant details that affect pricing (e.g. Jupiter-8 DCB-only vs MIDI, 12-bit vs 14-bit DACs)

Without this knowledge, the model calibrates against price alone and can misread condition disclosures — treating a repairable known fault as a red flag, or missing an undisclosed variant detail that buyers care about.

Two approaches were considered:

**Option A — Programmatic knowledge injection** (`feature/synth-knowledge-files` branch): Load a markdown file for the synth model from a `knowledge/` directory at call time. Concatenate it into the prompt as a stable content block before the listing data. Simple, no new API features required.

**Option B — Anthropic Skills API**: Package the knowledge files as a custom Skill uploaded to Anthropic's API. Include the skill in the `analyzeListings` call via the `container.skills` parameter alongside the code execution tool. Claude reads the relevant resource file autonomously before scoring.

## Decision

Use the **Anthropic Skills API** (Option B).

The skill package lives at `skill/valuing-vintage-synths/` and contains `SKILL.md` (overview + file index) and per-synth resource files under `resources/`. It is uploaded once via `npm run upload-skill`; the resulting skill ID is stored in `ANTHROPIC_SKILL_ID`.

The `analyzeListings` function uses a two-phase pattern when a skill ID is present:

1. **Phase 1** — `tool_choice: auto` with code execution + skill container. Claude reads SKILL.md and the relevant resource file via code execution, looping on `pause_turn` until done.
2. **Phase 2** — `tool_choice: { type: "tool", name: "analyze_listings" }` (forced). Claude produces the structured `ScoredListing[]` output using the knowledge it just read.

When `ANTHROPIC_SKILL_ID` is not set, the function falls back to the standard `messages.create` path unchanged — the skill is optional.

## Consequences

**Benefits:**
- Progressive disclosure: Claude reads only the resource file for the model being scanned, not all of them. Token cost scales with what's needed.
- Knowledge files are plain markdown — adding coverage for a new synth is `skill/valuing-vintage-synths/resources/moog-minimoog.md` plus a re-upload. No code changes required.
- The skill is independently versioned and can be updated without a code deploy.

**Costs / limitations:**
- Requires an initial `npm run upload-skill` setup step. The skill ID must be kept in `.env`.
- The Anthropic TypeScript SDK (v0.78.0) has no `files_from_dir()` equivalent. Its multipart serializer strips directory components from filenames by default, making skill uploads fail silently. A raw `fetch`-based upload script works around this — the workaround is documented in `scripts/upload-skill.mts`.
- The two-phase call pattern adds latency and complexity vs. the single forced tool call in the no-skill path.
- Skills require the `code-execution` and `skills` beta headers, which are not eligible for Zero Data Retention.

## Alternatives Not Chosen

**Programmatic injection (Option A):** Simpler and works without any Anthropic API setup. The approach is preserved on the `feature/synth-knowledge-files` branch. Its main limitation is that knowledge is injected regardless of relevance — all files are read at call time, not on demand. For a small number of synths the difference is negligible, but the skill approach is cleaner as the knowledge base grows.
