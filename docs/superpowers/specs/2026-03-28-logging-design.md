# Slice 3.5: Comprehensive Logging — Design Spec

## Goal

Add real-time visibility into the scan pipeline. Every LLM call is logged before and after so the operator can see progress, latency, and results as they happen. Output is written to timestamped files so runs are preserved for review.

---

## Architecture

Logging is injected into `scan()` via `ScanDependencies` — consistent with the existing dependency injection pattern. The CLI wires up a real logger; tests pass a no-op. `scan.ts` emits structured events at natural points in the pipeline.

**Files changed:**

| Action | File | What changes |
|--------|------|-------------|
| Create | `packages/agent/src/lib/logger.ts` | `Logger` interface + `createLogger` factory |
| Modify | `packages/agent/src/lib/scan.ts` | Add `log` to `ScanDependencies`; add log calls |
| Modify | `packages/agent/src/lib/scan.test.ts` | Pass `log: () => {}` no-op |
| Modify | `packages/agent/scripts/scan.ts` | Wire logger; write JSON to file; no more `console.log` |

---

## Logger Module

`packages/agent/src/lib/logger.ts` exports:

```typescript
export interface Logger {
  log: (message: string) => void;
}

export function createLogger(logPath: string): Logger
```

`createLogger` opens the log file at `logPath` once. Each `log(message)` call:
1. Formats the line as `[HH:MM:SS] message`
2. Writes it synchronously to the file (so progress is visible live)
3. Mirrors it to stdout

---

## Log Events

`scan.ts` calls `deps.log(...)` at these points:

```
[12:03:41] Scanning 1 watchlist item(s)

[12:03:41] Roland Juno-106 — fetching listings...
[12:03:42] Found 50 listings, 23 sold comps (last 90 days)

[12:03:42]   [1/50] "Roland Juno-106 with Hard Case" ($2,300.00)
[12:03:42]          Normalising...
[12:03:44]          → excellent | extras: hard case | red flags: none
[12:03:44]          Scoring...
[12:03:46]          → fair-deal

[12:03:46]   [2/50] "Roland Juno-106 SH-101 Pitch Bender lever" ($40.90)
[12:03:47]          Normalising...
[12:03:49]          → mint | extras: none | red flags: none
[12:03:49]          Scoring...
[12:03:51]          → strong-bargain
...
[12:05:12] Done — 3 strong-bargain, 12 fair-deal, 35 overpriced
[12:05:12] Log:    output/scan-2026-03-28T12-03-41.log
[12:05:12] Output: output/scan-2026-03-28T12-03-41.json
```

The timestamps naturally expose LLM call latency — no explicit timing fields needed.

**Formatting rules:**
- Price formatted as USD dollars: `$2,300.00` (price in cents ÷ 100)
- Extras: comma-joined list, or `none` if empty
- Red flags: comma-joined list, or `none` if empty

---

## CLI Changes (`packages/agent/scripts/scan.ts`)

1. At startup, generate a timestamp slug: `2026-03-28T12-03-41` (colons replaced with dashes for filesystem compatibility)
2. Run `mkdir -p output` to ensure the directory exists
3. Create logger: `createLogger("output/scan-<timestamp>.log")`
4. Pass `logger.log` into `scan()`
5. After `scan()` completes, write JSON to `output/scan-<timestamp>.json`
6. Remove the existing `console.log(JSON.stringify(reports, null, 2))` — stdout carries only log lines henceforth

---

## Testing

No new tests for logging. Existing tests in `scan.test.ts` pass `log: () => {}` — the no-op satisfies the interface without any behaviour change.
