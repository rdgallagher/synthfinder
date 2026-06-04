---
name: valuing-vintage-synths
description: Provides model-specific knowledge for evaluating vintage synthesizer listings — known failure modes, desirable mods, and variant details that affect value. Use when analyzing synth listings for deal quality.
---

# Valuing Vintage Synthesizers

Before analyzing listings, read the model-specific knowledge file for the synth being evaluated.

## Model knowledge files

- Roland Juno-106 → [resources/roland-juno-106.md](resources/roland-juno-106.md)
- Roland Jupiter-6 → [resources/roland-jupiter-6.md](resources/roland-jupiter-6.md)
- Roland Jupiter-8 → [resources/roland-jupiter-8.md](resources/roland-jupiter-8.md)

If no file exists for the model, apply general principles only.

## General principles (all models)

- Condition claims in listings are optimistic — weight the description over the stated condition label
- "Sold as-is" signals known issues the seller won't stand behind
- Extras (original case, manual, recent service) add real value; missing hard-to-source cosmetic parts subtract it
- Price premium for excellent/mint condition is steep on collectable synths — don't compare excellent to good pricing

After reading the relevant knowledge file, call `analyze_listings` with your assessment for all listings.
