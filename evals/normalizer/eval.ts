import { normalize } from "../../packages/agent/src/lib/normalizer.js";
import type { Listing, ConditionTier } from "@synthfinder/shared";

interface EvalCase {
  input: Listing;
  expected: {
    canonicalModel: string;
    conditionTier: ConditionTier;
    extras: string[];
    redFlags: string[];
  };
}

// Fuzzy match: check if expected items are present in actual (case-insensitive, substring)
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

async function main() {
  // Ensure we're using real LLM, not stubs
  delete process.env.LLM_MODE;

  const casesFile = new URL("./cases.json", import.meta.url);
  const cases: EvalCase[] = JSON.parse(
    await import("node:fs/promises").then((fs) => fs.readFile(casesFile, "utf-8")),
  );

  let totalFields = 0;
  let correctFields = 0;
  const results: Array<{ id: string; pass: boolean; details: string[] }> = [];

  for (const evalCase of cases) {
    const details: string[] = [];
    let caseCorrect = 0;
    let caseTotal = 0;

    try {
      const result = await normalize(evalCase.input);

      // Check canonical model
      caseTotal++;
      if (result.canonicalModel.toLowerCase() === evalCase.expected.canonicalModel.toLowerCase()) {
        caseCorrect++;
      } else {
        details.push(
          `canonicalModel: expected "${evalCase.expected.canonicalModel}", got "${result.canonicalModel}"`,
        );
      }

      // Check condition tier
      caseTotal++;
      if (result.conditionTier === evalCase.expected.conditionTier) {
        caseCorrect++;
      } else {
        details.push(
          `conditionTier: expected "${evalCase.expected.conditionTier}", got "${result.conditionTier}"`,
        );
      }

      // Check extras (fuzzy)
      // Array fields pass if ≥50% of expected items are fuzzy-matched.
      // This tolerates rephrasing while still requiring approximate coverage.
      caseTotal++;
      const extrasScore = fuzzyArrayMatch(result.extras, evalCase.expected.extras);
      if (extrasScore >= 0.5) {
        caseCorrect++;
      } else {
        details.push(
          `extras: expected ${JSON.stringify(evalCase.expected.extras)}, got ${JSON.stringify(result.extras)}`,
        );
      }

      // Check red flags (fuzzy)
      // Array fields pass if ≥50% of expected items are fuzzy-matched.
      // This tolerates rephrasing while still requiring approximate coverage.
      caseTotal++;
      const flagsScore = fuzzyArrayMatch(result.redFlags, evalCase.expected.redFlags);
      if (flagsScore >= 0.5) {
        caseCorrect++;
      } else {
        details.push(
          `redFlags: expected ${JSON.stringify(evalCase.expected.redFlags)}, got ${JSON.stringify(result.redFlags)}`,
        );
      }
    } catch (error) {
      details.push(`ERROR: ${error}`);
      caseTotal = 4;
    }

    totalFields += caseTotal;
    correctFields += caseCorrect;
    results.push({
      id: evalCase.input.id,
      pass: caseCorrect === caseTotal,
      details,
    });
  }

  // Report
  console.log("\n=== Normalizer Eval Results ===\n");
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
