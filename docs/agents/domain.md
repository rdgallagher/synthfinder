# Domain Docs

How the engineering skills should consume this repo's domain documentation when
exploring the codebase.

## Before exploring, read these

- **`CONTEXT.md`** at the repo root, or
- **`CONTEXT-MAP.md`** at the repo root if it exists — it points at one `CONTEXT.md`
  per context. Read each one relevant to the topic.
- **`adr/`** — read ADRs that touch the area you're about to work in. (This repo keeps
  ADRs at `adr/` in the root, not `docs/adr/`.)

If any of these files don't exist, **proceed silently**. Don't flag their absence;
don't suggest creating them upfront. The producer skill (`/grill-with-docs`) creates
them lazily when terms or decisions actually get resolved.

## File structure

This is a **single-context** repo:

```
/
├── CONTEXT.md
├── adr/
│   ├── 001-mvp-scope.md
│   ├── 002-marketplace-abstraction.md
│   └── …
└── packages/
```

If this repo is later split into bounded-context packages (the SynthTrader
direction), migrate to a multi-context layout: a `CONTEXT-MAP.md` at the root
pointing to one `CONTEXT.md` per context, with context-scoped decisions under
`packages/<context>/docs/adr/`.

## Use the glossary's vocabulary

When your output names a domain concept (in an issue title, a refactor proposal, a
hypothesis, a test name), use the term as defined in `CONTEXT.md`. Don't drift to
synonyms the glossary explicitly avoids.

If the concept you need isn't in the glossary yet, that's a signal — either you're
inventing language the project doesn't use (reconsider) or there's a real gap (note
it for `/grill-with-docs`).

## Flag ADR conflicts

If your output contradicts an existing ADR, surface it explicitly rather than
silently overriding:

> _Contradicts ADR-002 (marketplace abstraction) — but worth reopening because…_
