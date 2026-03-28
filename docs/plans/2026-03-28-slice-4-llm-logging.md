# LLM Interaction Logging — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Log every LLM prompt and raw tool_use response to the `.log` file, activated via `LOG_LEVEL=debug`.

**Architecture:** `Logger` gains a `debug` method (no-op when disabled). `normalize` and `score` accept an optional `debug?` callback and use it to log prompt text before and tool_use JSON after each LLM call. `scripts/scan.ts` reads `LOG_LEVEL`, passes `debugEnabled` to `createLogger`, and closes over `logger.debug` in the `normalize`/`score` lambdas.

**Tech Stack:** Node.js `fs` (already used), TypeScript strict mode, no new dependencies. Vitest — no new tests (all new params are optional; existing 31 tests must pass unchanged).

---

## File Map

| Action | File | Change |
|--------|------|--------|
| Modify | `packages/agent/src/lib/logger.ts` | Add `debug` to `Logger` interface; add `debugEnabled` param to `createLogger` |
| Modify | `packages/agent/src/lib/normalizer.ts` | Add `debug?` trailing param; log prompt before + tool_use after LLM call |
| Modify | `packages/agent/src/lib/scorer.ts` | Add `debug?` trailing param; log prompt before + tool_use after LLM call |
| Modify | `packages/agent/scripts/scan.ts` | Read `LOG_LEVEL`; pass `debugEnabled` to `createLogger`; close over `logger.debug` in lambdas |

`scan.ts` and `scan.test.ts` do **not** change.

---

## Task 1: Extend the logger module

**Files:**
- Modify: `packages/agent/src/lib/logger.ts`

- [ ] **Step 1: Replace `logger.ts` with the extended version**

```typescript
import { appendFileSync } from "node:fs";

export interface Logger {
  log: (message: string) => void;
  debug: (message: string) => void;
}

function nowHHMMSS(): string {
  return new Date().toTimeString().slice(0, 8); // "HH:MM:SS"
}

export function createLogger(logPath: string, debugEnabled = false): Logger {
  return {
    log(message: string): void {
      const line = `[${nowHHMMSS()}] ${message}\n`;
      process.stdout.write(line);
      appendFileSync(logPath, line);
    },
    debug(message: string): void {
      if (!debugEnabled) return;
      const line = `[${nowHHMMSS()}] [DEBUG] ${message}\n`;
      process.stdout.write(line);
      appendFileSync(logPath, line);
    },
  };
}
```

- [ ] **Step 2: Run tests to confirm nothing is broken**

```bash
npm test
```

Expected: 31 tests, all pass. (No new tests for logger — `debug` is a no-op by default and the existing suite confirms nothing regressed.)

- [ ] **Step 3: Run type-check**

```bash
npm run type-check
```

Expected: no errors. `scripts/scan.ts` still compiles because `createLogger(logPath)` is valid — `debugEnabled` defaults to `false`.

- [ ] **Step 4: Commit**

```bash
git add packages/agent/src/lib/logger.ts
git commit -m "feat: add debug method to Logger; add debugEnabled param to createLogger"
```

---

## Task 2: Add debug logging to the normalizer

**Files:**
- Modify: `packages/agent/src/lib/normalizer.ts`

The `normalize` function accepts an optional trailing `debug?` callback. When provided, it logs the LLM prompt (before the API call) and the raw `tool_use` block (after).

- [ ] **Step 1: Replace the `normalize` function signature and body**

Replace only the `normalize` function (lines 55–88). Everything else in the file stays the same.

```typescript
export async function normalize(
  listing: Listing,
  debug?: (msg: string) => void,
): Promise<NormalizedListing> {
  if (process.env.LLM_MODE === "stub") {
    return stubNormalize(listing);
  }

  const d = debug ?? (() => {});

  const prompt = `Extract structured data from this marketplace listing:\n\nTitle: ${listing.title}\nDescription: ${listing.description}\nPrice: $${(listing.price / 100).toFixed(2)}\nCondition: ${listing.condition}`;

  d(`normaliser › input:\n${prompt}`);

  const response = await anthropic.messages.create({
    model: "claude-haiku-4-5",
    max_tokens: 1024,
    tools: [NORMALIZE_TOOL],
    tool_choice: { type: "tool", name: "normalize_listing" },
    messages: [{ role: "user", content: prompt }],
  });

  const toolUse = response.content.find((block) => block.type === "tool_use");
  if (!toolUse || toolUse.type !== "tool_use") {
    throw new Error("Normalizer: no tool_use block in response");
  }

  d(`normaliser › output:\n${JSON.stringify(toolUse)}`);

  const input = toolUse.input as NormalizeToolInput;

  return {
    canonicalModel: input.canonical_model,
    conditionTier: input.condition_tier,
    price: listing.price,
    extras: input.extras,
    redFlags: input.red_flags,
    originalListing: listing,
  };
}
```

- [ ] **Step 2: Run tests**

```bash
npm test
```

Expected: 31 tests, all pass. Existing normalizer tests call `normalize(listing)` without a debug arg — the optional trailing param makes this valid.

- [ ] **Step 3: Run type-check**

```bash
npm run type-check
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add packages/agent/src/lib/normalizer.ts
git commit -m "feat: add debug logging to normalizer (prompt + tool_use output)"
```

---

## Task 3: Add debug logging to the scorer

**Files:**
- Modify: `packages/agent/src/lib/scorer.ts`

Mirrors what was done to the normalizer: optional `debug?` trailing param, log prompt before + tool_use JSON after.

- [ ] **Step 1: Replace the `score` function signature and body**

Replace only the `score` function (lines 61–102). Everything else in the file stays the same.

```typescript
export async function score(
  normalized: NormalizedListing,
  soldListings: SoldListing[],
  debug?: (msg: string) => void,
): Promise<ScoredListing> {
  if (process.env.LLM_MODE === "stub") {
    return stubScore(normalized, soldListings);
  }

  const d = debug ?? (() => {});

  const soldSummary = soldListings
    .map(
      (s) =>
        `- ${s.title}: sold for $${(s.soldPrice / 100).toFixed(2)} on ${s.soldDate} (${s.condition})`,
    )
    .join("\n");

  const prompt = `Score this synthesizer listing as a deal.\n\nListing:\n- Model: ${normalized.canonicalModel}\n- Condition: ${normalized.conditionTier}\n- Price: $${(normalized.price / 100).toFixed(2)}\n- Extras: ${normalized.extras.join(", ") || "none"}\n- Red flags: ${normalized.redFlags.join(", ") || "none"}\n\nRecent sold listings for comparison:\n${soldSummary || "No sold data available."}`;

  d(`scorer › input:\n${prompt}`);

  const response = await anthropic.messages.create({
    model: "claude-haiku-4-5",
    max_tokens: 1024,
    tools: [SCORE_TOOL],
    tool_choice: { type: "tool", name: "score_listing" },
    messages: [{ role: "user", content: prompt }],
  });

  const toolUse = response.content.find((block) => block.type === "tool_use");
  if (!toolUse || toolUse.type !== "tool_use") {
    throw new Error("Scorer: no tool_use block in response");
  }

  d(`scorer › output:\n${JSON.stringify(toolUse)}`);

  const input = toolUse.input as ScoreToolInput;

  return {
    normalizedListing: normalized,
    dealTier: input.deal_tier,
    reasoning: input.reasoning,
    comparables: input.comparables,
  };
}
```

- [ ] **Step 2: Run tests**

```bash
npm test
```

Expected: 31 tests, all pass. Existing scorer tests call `score(normalized, soldListings)` — the optional param is backwards-compatible.

- [ ] **Step 3: Run type-check**

```bash
npm run type-check
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add packages/agent/src/lib/scorer.ts
git commit -m "feat: add debug logging to scorer (prompt + tool_use output)"
```

---

## Task 4: Wire debug in the CLI entry point

**Files:**
- Modify: `packages/agent/scripts/scan.ts`

Read `LOG_LEVEL`, pass `debugEnabled` to `createLogger`, and close over `logger.debug` in the normalize/score lambdas so debug propagates into the real functions.

- [ ] **Step 1: Replace `scripts/scan.ts` with the wired version**

```typescript
import { mkdirSync, writeFileSync } from "node:fs";
import type { WatchlistItem } from "@synthfinder/shared";
import { scan } from "../src/lib/scan.js";
import { SynthfinderMcpClient } from "../src/lib/mcp-client.js";
import { normalize } from "../src/lib/normalizer.js";
import { score } from "../src/lib/scorer.js";
import { createLogger } from "../src/lib/logger.js";

const watchlist: WatchlistItem[] = [{ model: "Roland Juno-106" }];

const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, "-");
mkdirSync("output", { recursive: true });

const logPath = `output/scan-${timestamp}.log`;
const outputPath = `output/scan-${timestamp}.json`;
const debugEnabled = process.env.LOG_LEVEL === "debug";
const logger = createLogger(logPath, debugEnabled);

const mcpClient = new SynthfinderMcpClient();
await mcpClient.connect();

try {
  const reports = await scan({
    watchlist,
    searchListings: (query) => mcpClient.searchListings(query),
    getSoldListings: (query, since) => mcpClient.getSoldListings(query, since),
    normalize: (listing) => normalize(listing, logger.debug),
    score: (normalized, soldListings) => score(normalized, soldListings, logger.debug),
    log: logger.log,
  });

  writeFileSync(outputPath, JSON.stringify(reports, null, 2));
  logger.log(`Log:    ${logPath}`);
  logger.log(`Output: ${outputPath}`);
} finally {
  await mcpClient.close();
}
```

- [ ] **Step 2: Run tests and type-check**

```bash
npm test && npm run type-check
```

Expected: 31 tests pass, no type errors.

- [ ] **Step 3: Smoke test in stub mode (confirm no debug output without LOG_LEVEL)**

```bash
LLM_MODE=stub MARKETPLACE=fixture npm run scan
```

Expected: same output as before — no `[DEBUG]` lines. Both `output/scan-*.log` and `output/scan-*.json` created.

- [ ] **Step 4: Smoke test with `LOG_LEVEL=debug` in stub mode**

```bash
LOG_LEVEL=debug LLM_MODE=stub MARKETPLACE=fixture npm run scan
```

Expected: `[DEBUG]` lines are NOT emitted because `LLM_MODE=stub` returns early before calling the debug callback. Output is identical to the non-debug run. This is correct — stubs have no LLM calls to log.

- [ ] **Step 5: Commit**

```bash
git add packages/agent/scripts/scan.ts
git commit -m "feat: wire LOG_LEVEL=debug into CLI; thread logger.debug through normalize/score"
```

---

## Self-Review

**Spec coverage:**
- ✅ `Logger.debug` method added to interface and `createLogger`
- ✅ `debugEnabled = false` default — no change to existing behaviour
- ✅ `[HH:MM:SS] [DEBUG] ...` format
- ✅ Written to stdout + file (same path as `log`)
- ✅ `normaliser › input:` logged before API call
- ✅ `normaliser › output:` logged after API call (raw `tool_use` JSON)
- ✅ `scorer › input:` and `scorer › output:` likewise
- ✅ Activated via `LOG_LEVEL=debug`
- ✅ No-op when `LLM_MODE=stub` (stubs return early, skipping debug calls)
- ✅ Existing 31 tests unchanged — all new params optional

**Placeholder scan:** None.

**Type consistency:** `debug?: (msg: string) => void` used consistently as the callback type in `normalizer.ts`, `scorer.ts`, and `Logger.debug`. The `d` alias inside each function matches the same signature.
