# ADR-006: No Database in MVP

## Status
Accepted

## Context
The system needs historical sold-price data to assess whether a listing is a bargain. We could store this in a database, but that adds infrastructure complexity. Reverb's API provides access to sold/completed listings, which can serve as our price history source in real time.

## Decision
In the MVP, fetch sold-listing data from the Reverb API on every scan run. Do not persist any data beyond the output deal report (written to a log file).

**Data flow:**
1. For each synth on the watchlist, call `getSoldListings()` to get recent sold prices.
2. Pass these in-memory to the scorer alongside active listings.
3. Write the final scored report to `output/` as a timestamped file.

**When to revisit:** Add a database when any of these become true:
- We need price data that Reverb's API doesn't provide (e.g., longer history, cross-marketplace aggregation).
- API rate limits make repeated fetching impractical.
- We want to track trends over time (price appreciation/depreciation).
- The web UI needs to serve stored data.

Likely choice when the time comes: PostgreSQL via Supabase or Neon (free tier, managed, good DX).

## Consequences
- Zero infrastructure to set up or maintain for the MVP.
- Each scan is self-contained and stateless — easy to reason about and test.
- We're dependent on Reverb's API availability and rate limits for every run.
- No ability to track trends over time until we add persistence.
- The marketplace abstraction's return types are designed to be database-friendly, so the migration path is straightforward.
