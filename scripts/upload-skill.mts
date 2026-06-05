import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";

// The Anthropic TypeScript SDK has no equivalent of Python's files_from_dir().
// The SDK's multipart serializer strips directory components from filenames,
// which breaks skill uploads. We build FormData manually instead.
//
// The API requires all files to share a top-level directory prefix in their
// Content-Disposition filenames (e.g. "skill-name/SKILL.md"), with field
// name "files[]". Python's files_from_dir() handles this transparently.

const SKILL_DIR = join(process.cwd(), "skill/valuing-vintage-synths");
const API_KEY = process.env.ANTHROPIC_API_KEY;
if (!API_KEY) throw new Error("ANTHROPIC_API_KEY not set");

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

const entries = collectFiles(SKILL_DIR, SKILL_DIR);

const form = new FormData();
form.append("display_title", "Valuing Vintage Synthesizers");

// Each file's relative path (e.g. "resources/roland-juno-106.md") becomes
// the form field name — the API uses these to reconstruct the directory tree.
// The API uses the filename in Content-Disposition to reconstruct the
// directory tree. Field name must be "files[]"; the relative path (prefixed
// with the skill dir name) goes in the filename slot (third arg to append).
const SKILL_NAME = "valuing-vintage-synths";
for (const { path, name } of entries) {
  form.append("files[]", new Blob([readFileSync(path)], { type: "text/plain" }), `${SKILL_NAME}/${name}`);
}

const response = await fetch("https://api.anthropic.com/v1/skills?beta=true", {
  method: "POST",
  headers: {
    "x-api-key": API_KEY,
    "anthropic-version": "2023-06-01",
    "anthropic-beta": "skills-2025-10-02",
  },
  body: form,
});

if (!response.ok) {
  const body = await response.text();
  throw new Error(`Anthropic API ${response.status}: ${body}`);
}

const skill = (await response.json()) as { id: string };
console.log(`Skill created: ${skill.id}`);
console.log(`Add to .env:  ANTHROPIC_SKILL_ID=${skill.id}`);
