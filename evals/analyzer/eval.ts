import { analyzeListings } from "../../packages/agent/src/lib/analyzer.js";
import type { Listing, SoldListing, ConditionTier, DealTier } from "@synthfinder/shared";

interface EvalCase {
  input: {
    listing: Listing;
    soldListings: SoldListing[];
  };
  expected: {
    canonicalModel?: string;
    conditionTier?: ConditionTier;
    extras?: string[];
    redFlags?: string[];
    dealTier?: DealTier;
    reasoning_must_mention?: string[];
  };
}

// Fuzzy match: fraction of expected items present in actual (case-insensitive, substring).
function fuzzyArrayMatch(actual: string[], expected: string[]): number {
  if (expected.length === 0) return actual.length === 0 ? 1 : 0;
  let matches = 0;
  for (const exp of expected) {
    const found = actual.some(
      (a) =>
        a.toLowerCase().includes(exp.toLowerCase()) ||
        exp.toLowerCase().includes(a.toLowerCase()),
    );
    if (found) matches++;
  }
  return matches / expected.length;
}

function normalizeAmount(s: string): string {
  return s.replace(/,/g, "").replace(/\.00\b/g, "");
}

async function main() {
  // Ensure we're using the real LLM, not stubs.
  delete process.env.LLM_MODE;

  const casesFile = new URL("./cases.json", import.meta.url);
  const cases: EvalCase[] = JSON.parse(
    await import("node:fs/promises").then((fs) => fs.readFile(casesFile, "utf-8")),
  );

  let totalFields = 0;
  let correctFields = 0;
  const results: Array<{ id: string; pass: boolean; details: string[] }> = [];

  for (const evalCase of cases) {
    const { listing, soldListings } = evalCase.input;
    const exp = evalCase.expected;
    const details: string[] = [];
    let caseCorrect = 0;
    let caseTotal = 0;

    try {
      // Single-listing batch keeps each case's relative calibration self-contained.
      const [result] = await analyzeListings([listing], soldListings);
      const n = result.normalizedListing;

      if (exp.canonicalModel !== undefined) {
        caseTotal++;
        if (n.canonicalModel.toLowerCase() === exp.canonicalModel.toLowerCase()) {
          caseCorrect++;
        } else {
          details.push(
            `canonicalModel: expected "${exp.canonicalModel}", got "${n.canonicalModel}"`,
          );
        }
      }

      if (exp.conditionTier !== undefined) {
        caseTotal++;
        if (n.conditionTier === exp.conditionTier) {
          caseCorrect++;
        } else {
          details.push(
            `conditionTier: expected "${exp.conditionTier}", got "${n.conditionTier}"`,
          );
        }
      }

      // Array fields pass if ≥50% of expected items are fuzzy-matched.
      if (exp.extras !== undefined) {
        caseTotal++;
        if (fuzzyArrayMatch(n.extras, exp.extras) >= 0.5) {
          caseCorrect++;
        } else {
          details.push(
            `extras: expected ${JSON.stringify(exp.extras)}, got ${JSON.stringify(n.extras)}`,
          );
        }
      }

      if (exp.redFlags !== undefined) {
        caseTotal++;
        if (fuzzyArrayMatch(n.redFlags, exp.redFlags) >= 0.5) {
          caseCorrect++;
        } else {
          details.push(
            `redFlags: expected ${JSON.stringify(exp.redFlags)}, got ${JSON.stringify(n.redFlags)}`,
          );
        }
      }

      if (exp.dealTier !== undefined) {
        caseTotal++;
        if (result.dealTier === exp.dealTier) {
          caseCorrect++;
        } else {
          details.push(`dealTier: expected "${exp.dealTier}", got "${result.dealTier}"`);
        }
      }

      if (exp.reasoning_must_mention !== undefined) {
        caseTotal++;
        const missing = exp.reasoning_must_mention.filter(
          (term) => !normalizeAmount(result.reasoning).includes(normalizeAmount(term)),
        );
        if (missing.length === 0 && result.reasoning.length >= 20) {
          caseCorrect++;
        } else {
          if (missing.length > 0) {
            details.push(
              `reasoning missing ${JSON.stringify(missing)} in "${result.reasoning}"`,
            );
          }
          if (result.reasoning.length < 20) {
            details.push(`reasoning too short: ${result.reasoning.length} chars`);
          }
        }
      }
    } catch (error) {
      details.push(`ERROR: ${error}`);
      caseTotal = Math.max(caseTotal, 1);
    }

    totalFields += caseTotal;
    correctFields += caseCorrect;
    results.push({
      id: listing.id,
      pass: caseTotal > 0 && caseCorrect === caseTotal,
      details,
    });
  }

  console.log("\n=== Analyzer Eval Results ===\n");
  for (const r of results) {
    console.log(`${r.pass ? "✅" : "❌"} ${r.id}`);
    for (const d of r.details) {
      console.log(`   ${d}`);
    }
  }

  const accuracy = ((correctFields / totalFields) * 100).toFixed(1);
  console.log(`\nField accuracy: ${correctFields}/${totalFields} (${accuracy}%)`);
  console.log(`Threshold: 85%`);

  if (correctFields / totalFields < 0.85) {
    console.log("FAIL: Below threshold");
    process.exit(1);
  } else {
    console.log("PASS");
  }
}

main();
