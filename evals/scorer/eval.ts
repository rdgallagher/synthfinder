import { score } from "../../packages/agent/src/lib/scorer.js";
import type { NormalizedListing, SoldListing, DealTier } from "@synthfinder/shared";

interface EvalCase {
  input: {
    normalized: NormalizedListing;
    soldListings: SoldListing[];
  };
  expected: {
    dealTier: DealTier;
    reasoning_must_mention: string[];
  };
}

async function main() {
  delete process.env.LLM_MODE;

  const casesFile = new URL("./cases.json", import.meta.url);
  const cases: EvalCase[] = JSON.parse(
    await import("node:fs/promises").then((fs) => fs.readFile(casesFile, "utf-8")),
  );

  let passed = 0;
  const results: Array<{ id: string; pass: boolean; details: string[] }> = [];

  for (const evalCase of cases) {
    const details: string[] = [];
    let casePassed = true;

    try {
      const result = await score(evalCase.input.normalized, evalCase.input.soldListings);

      // Check deal tier
      if (result.dealTier !== evalCase.expected.dealTier) {
        casePassed = false;
        details.push(
          `dealTier: expected "${evalCase.expected.dealTier}", got "${result.dealTier}"`,
        );
      }

      // Check reasoning mentions required terms
      for (const term of evalCase.expected.reasoning_must_mention) {
        if (!result.reasoning.includes(term)) {
          casePassed = false;
          details.push(`reasoning missing: "${term}" not found in "${result.reasoning}"`);
        }
      }

      // Check reasoning is substantial (not just a few words)
      if (result.reasoning.length < 20) {
        casePassed = false;
        details.push(`reasoning too short: ${result.reasoning.length} chars`);
      }
    } catch (error) {
      casePassed = false;
      details.push(`ERROR: ${error}`);
    }

    if (casePassed) passed++;
    results.push({
      id: evalCase.input.normalized.originalListing.id,
      pass: casePassed,
      details,
    });
  }

  // Report
  console.log("\n=== Scorer Eval Results ===\n");
  for (const r of results) {
    console.log(`${r.pass ? "✅" : "❌"} ${r.id}`);
    for (const d of r.details) {
      console.log(`   ${d}`);
    }
  }

  const passRate = ((passed / cases.length) * 100).toFixed(1);
  console.log(`\nPass rate: ${passed}/${cases.length} (${passRate}%)`);
  console.log(`Threshold: 85%`);

  if (passed / cases.length < 0.85) {
    console.log("FAIL: Below threshold");
    process.exit(1);
  } else {
    console.log("PASS");
  }
}

main();
