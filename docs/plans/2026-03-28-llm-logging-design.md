# LLM Interaction Logging — Design Spec

**Goal:** Log every LLM input (prompt text) and output (raw tool_use JSON) to the same timestamped `.log` file as progress logging, activated via `LOG_LEVEL=debug`.

---

## Logger Interface

`Logger` gains a `debug` method alongside `log`:

```typescript
export interface Logger {
  log: (message: string) => void;
  debug: (message: string) => void;
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

When `debugEnabled` is `false`, `debug()` is a no-op — zero overhead for normal runs.

### Sample output

```
[14:03:42] [DEBUG] normaliser › input:
Extract structured data from this marketplace listing:
Title: Roland Juno-106 with Hard Case
Price: $1,200.00
Condition: Excellent
Description: All keys work, filter chips intact...

[14:03:44] [DEBUG] normaliser › output:
{"type":"tool_use","name":"extract_listing","input":{"canonical_model":"Roland Juno-106","condition_tier":"excellent","extras":["hard case"],"red_flags":[]}}

[14:03:46] [DEBUG] scorer › input:
Score this listing against 3 sold comps...

[14:03:47] [DEBUG] scorer › output:
{"type":"tool_use","name":"score_listing","input":{"deal_tier":"fair-deal","reasoning":"Priced at $1,200; median comp is $1,050..."}}
```

---

## Pipeline Signature Changes

`normalize` and `score` accept an optional `debug` callback as a trailing parameter:

```typescript
export async function normalize(
  listing: Listing,
  debug?: (msg: string) => void,
): Promise<NormalizedListing>

export async function score(
  normalized: NormalizedListing,
  soldListings: SoldListing[],
  debug?: (msg: string) => void,
): Promise<ScoredListing>
```

`ScanDependencies` gains one optional field:

```typescript
export interface ScanDependencies {
  watchlist: WatchlistItem[];
  searchListings: (query: string) => Promise<Listing[]>;
  getSoldListings: (query: string, since: Date) => Promise<SoldListing[]>;
  normalize: (listing: Listing) => Promise<NormalizedListing>;
  score: (normalized: NormalizedListing, soldListings: SoldListing[]) => Promise<ScoredListing>;
  log?: (message: string) => void;
  debug?: (message: string) => void;  // new
}
```

`scan.ts` threads it through:

```typescript
const debug = deps.debug ?? (() => {});
// passes debug to each normalize() and score() call
```

No changes to `scan.test.ts` — all new fields are optional.

---

## CLI Wiring

In `scripts/scan.ts`, read `LOG_LEVEL` and pass both callbacks:

```typescript
const debugEnabled = process.env.LOG_LEVEL === "debug";
const logger = createLogger(logPath, debugEnabled);

const reports = await scan({
  watchlist,
  searchListings: (query) => mcpClient.searchListings(query),
  getSoldListings: (query, since) => mcpClient.getSoldListings(query, since),
  normalize: (listing) => normalize(listing, logger.debug),
  score: (normalized, soldListings) => score(normalized, soldListings, logger.debug),
  log: logger.log,
  debug: logger.debug,
});
```

---

## Activation

```bash
LOG_LEVEL=debug LLM_MODE=stub MARKETPLACE=fixture npm run scan
```

Normal runs (no `LOG_LEVEL`) produce no change to existing output.

---

## File Map

| Action | File | Change |
|--------|------|--------|
| Modify | `packages/agent/src/lib/logger.ts` | Add `debug` to `Logger`; add `debugEnabled` param to `createLogger` |
| Modify | `packages/agent/src/lib/normalizer.ts` | Add optional `debug?` param; log prompt + tool_use response |
| Modify | `packages/agent/src/lib/scorer.ts` | Add optional `debug?` param; log prompt + tool_use response |
| Modify | `packages/agent/src/lib/scan.ts` | Add `debug?` to `ScanDependencies`; thread through to normalize/score calls |
| Modify | `packages/agent/scripts/scan.ts` | Read `LOG_LEVEL`; pass `debugEnabled` to `createLogger`; wire `debug` |

No new test files — `debug` is optional everywhere, existing tests compile and pass unchanged.
