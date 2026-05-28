# Web UI — Design Spec

## Overview

A Next.js interface that lets the user trigger a live Reverb scan and watch results appear in real time. The scan runs server-side via an SSE-streaming API route that calls `scan()` directly. No terminal required.

---

## Pre-step: Extract hardcoded model from CLI

`packages/agent/scripts/scan.ts` currently hardcodes `[{ model: "Roland Juno-106" }]`. Extract to read from a `MODEL` env var with `Roland Juno-106` as the default, so:
- The CLI continues to work unchanged (`npm run scan` still scans for the Juno-106)
- The web API route can pass any model string

---

## Layout

Split panel, both visible simultaneously during a scan:

- **Left panel:** model input + Scan button at the top, scrolling progress log below
- **Right panel:** result cards that appear one by one as each listing completes

---

## API Route — `POST /api/scan`

**File:** `src/app/api/scan/route.ts`

**Request body:** `{ model: string }`

**Response:** `Content-Type: text/event-stream`, streamed via `ReadableStream`

### Event types

```
event: progress
data: {"message":"[14:30:33] Found 50 listings, 17 sold comps"}

event: result
data: {"listing": { ...ScoredListing }}

event: error
data: {"message":"Reverb API error: 401 Unauthorized"}
```

- `progress` — emitted for each `log()` call from `scan()`; one-to-one with the CLI output lines
- `result` — emitted once per listing immediately after it is scored (not batched); the frontend renders it as it arrives
- `error` — emitted if `scan()` throws; stream is then closed

### Implementation notes

- Instantiates `ReverbMarketplaceClient` (reads `REVERB_API_KEY` from env) and `SynthfinderMcpClient`
- Passes `log: (msg) => send('progress', { message: msg })` to `scan()`
- After each listing scores, emits a `result` event — requires a per-listing callback; add `onListing?: (scored: ScoredListing) => void` to `ScanDependencies` in `scan.ts`
- Wraps everything in try/catch; emits `error` event and closes stream on failure
- `Response` headers: `Cache-Control: no-cache`, `Connection: keep-alive`

---

## Frontend — `src/app/page.tsx`

### Interaction flow

1. User types a model name (default: `Roland Juno-106`) and clicks **Scan**
2. `fetch('POST /api/scan', { body: { model } })` — reads `response.body` as a `ReadableStream`
3. As chunks arrive, parse SSE events (split on `\n\n`, extract `event:` and `data:` lines)
4. `progress` events → append message to log, auto-scroll to bottom
5. `result` events → insert card into results panel sorted by deal tier
6. `error` event → show error banner in progress panel; re-enable Scan button
7. Stream closes → Scan button re-enables

### Result card

Each `ScoredListing` renders as a card showing:

| Field | Source |
|-------|--------|
| Deal tier badge (colour-coded) | `dealTier`: green = strong-bargain, grey = fair-deal, red = overpriced |
| Price | `normalizedListing.price` (cents → dollars) |
| Comp range | `comparables` — displayed as-is (already a human-readable string from the scorer) |
| Title | `originalListing.title` |
| Condition | `normalizedListing.conditionTier` |
| Extras | `normalizedListing.extras[]` — green chips |
| Red flags | `normalizedListing.redFlags[]` — red chips |
| Link | `originalListing.url` → "View on Reverb" |

No reasoning field — the structured data makes it self-evident.

### Sorting

Results are kept in deal-tier order: `strong-bargain` first, then `fair-deal`, then `overpriced`. On each `result` event, append to the array and re-sort by tier index before rendering.

### States

- **Idle:** form visible, results panel empty
- **Scanning:** Scan button disabled, progress log filling, cards appearing on the right
- **Complete:** Scan button re-enables, log shows final line, all cards visible
- **Error:** error banner in progress panel, Scan button re-enables

---

## `ScanDependencies` change

Add one optional field to the existing interface in `src/lib/scan.ts`:

```typescript
onListing?: (scored: ScoredListing) => void;
```

Called after each listing is scored, before `scan()` resolves. The API route uses this to emit `result` events incrementally. Existing callers (CLI, tests) are unaffected — the field is optional.

---

## Styling

Use the existing `globals.css` baseline. No new CSS framework. Dark theme consistent with the terminal aesthetic of the progress log.

---

## Out of scope

- Authentication
- Persisting scan history
- Multiple watchlist items
- Configuring `LOG_LEVEL=debug` from the UI
