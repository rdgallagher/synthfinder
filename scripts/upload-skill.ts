import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import Anthropic, { toFile } from "@anthropic-ai/sdk";

const SKILL_DIR = join(process.cwd(), "skill/valuing-vintage-synths");
const BETAS = ["skills-2025-10-02"] as const;

function collectFiles(dir: string, base: string): Array<{ path: string; name: string }> {
  const result: Array<{ path: string; name: string }> = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      result.push(...collectFiles(full, base));
    } else {
      result.push({ path: full, name: relative(base, full) });
    }
  }
  return result;
}

const client = new Anthropic();

const entries = collectFiles(SKILL_DIR, SKILL_DIR);
const files = await Promise.all(
  entries.map(({ path, name }) => toFile(readFileSync(path), name, { type: "text/plain" })),
);

const skill = await client.beta.skills.create(
  { display_title: "Valuing Vintage Synthesizers", files },
  { headers: { "anthropic-beta": BETAS.join(",") } },
);

console.log(`Skill created: ${skill.id}`);
console.log(`Add to .env:  ANTHROPIC_SKILL_ID=${skill.id}`);
