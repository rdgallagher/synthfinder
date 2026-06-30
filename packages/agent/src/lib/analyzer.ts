import type { AnalyzeKnowledge, Listing, LLMProvider, ScoredListing, SoldListing } from "@synthfinder/shared";
import { AnthropicProvider } from "./providers/anthropic-provider";
import { StubProvider } from "./providers/stub-provider";

/**
 * Select the {@link LLMProvider} for the analyze task. `LLM_MODE=stub` selects
 * the in-memory {@link StubProvider}; otherwise the {@link AnthropicProvider} is
 * used. This is the single place provider selection lives, keeping the scan
 * orchestrator and the rest of the analysis code free of provider specifics.
 */
export function selectProvider(): LLMProvider {
  if (process.env.LLM_MODE === "stub") {
    return new StubProvider();
  }
  return new AnthropicProvider();
}

/**
 * Seam adapter wired into `ScanDependencies.analyzeListings`. It builds an
 * `AnalyzePrompt` (reading the optional Anthropic Skill id from
 * `ANTHROPIC_SKILL_ID`), selects a provider, and delegates. The signature is
 * kept stable so the scan path and the `evals/analyzer` suite are unchanged.
 */
export async function analyzeListings(
  listings: Listing[],
  soldListings: SoldListing[],
  debug?: (msg: string) => void,
): Promise<ScoredListing[]> {
  const skillId = process.env.ANTHROPIC_SKILL_ID;
  const knowledge: AnalyzeKnowledge | undefined = skillId ? { skillId } : undefined;
  return selectProvider().analyzeListings({ listings, soldListings, knowledge }, debug);
}
