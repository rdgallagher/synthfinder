import { describe, it, expect } from "vitest";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { ScanReport } from "@synthfinder/shared";

const execFileAsync = promisify(execFile);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const scanScript = path.resolve(__dirname, "../../../scripts/scan.ts");

describe("scan e2e", () => {
  it("outputs a JSON deal report for watchlist items", async () => {
    const { stdout } = await execFileAsync("npx", ["tsx", scanScript], {
      env: {
        ...process.env,
        MARKETPLACE: "fixture",
        LLM_MODE: "stub",
      },
      timeout: 30000,
    });

    const reports: ScanReport[] = JSON.parse(stdout);

    expect(Array.isArray(reports)).toBe(true);
    expect(reports.length).toBeGreaterThan(0);

    const report = reports[0];
    expect(report.watchlistItem.model).toBe("Roland Juno-106");
    expect(report.scoredListings.length).toBeGreaterThan(0);
    expect(report.scannedAt).toBeDefined();

    const scored = report.scoredListings[0];
    expect(["strong-bargain", "fair-deal", "overpriced"]).toContain(scored.dealTier);
    expect(scored.reasoning).toBeTruthy();
    expect(scored.normalizedListing.canonicalModel).toBeTruthy();
  }, 30000);
});
