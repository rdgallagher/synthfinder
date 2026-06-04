import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

function modelToFilename(model: string): string {
  return model.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "") + ".md";
}

export function loadKnowledge(model: string, knowledgeDir: string): string | undefined {
  const filepath = join(knowledgeDir, modelToFilename(model));
  if (!existsSync(filepath)) return undefined;
  return readFileSync(filepath, "utf-8");
}
