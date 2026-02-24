# Slice 1: Project Scaffolding — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Set up a working npm workspaces monorepo with three packages (shared, mcp-server, agent/Next.js) — green builds, passing linter, `npm run dev` shows the Next.js default page.

**Architecture:** npm workspaces monorepo. `packages/shared/` exports TypeScript source directly (no build step). `packages/agent/` is a Next.js 16 App Router app that consumes shared via `transpilePackages`. `packages/mcp-server/` is a plain Node/TypeScript project. Root-level Vitest with per-package project configs. Root-level ESLint + Prettier.

**Tech Stack:** TypeScript (strict), Next.js 16 (App Router, Turbopack), Vitest, ESLint (flat config), Prettier, npm workspaces

---

### Task 1: Root package.json and workspace config

**Files:**
- Create: `package.json`

**Step 1: Create root package.json**

```json
{
  "name": "synthfinder-agent",
  "private": true,
  "workspaces": [
    "packages/*"
  ],
  "scripts": {
    "dev": "npm run dev --workspace=packages/agent",
    "build": "npm run build --workspace=packages/agent",
    "test": "vitest run",
    "test:watch": "vitest",
    "lint": "eslint packages/",
    "lint:fix": "eslint packages/ --fix",
    "format": "prettier --write 'packages/*/src/**/*.{ts,tsx}'",
    "format:check": "prettier --check 'packages/*/src/**/*.{ts,tsx}'",
    "type-check": "tsc --build",
    "scan": "tsx packages/agent/scripts/scan.ts"
  }
}
```

**Step 2: Commit**

```bash
git add package.json
git commit -m "Add root package.json with npm workspaces"
```

---

### Task 2: Root TypeScript config

**Files:**
- Create: `tsconfig.base.json`
- Create: `tsconfig.json`

**Step 1: Create shared base compiler options**

`tsconfig.base.json`:
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "Node16",
    "moduleResolution": "Node16",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "isolatedModules": true
  }
}
```

**Step 2: Create root tsconfig.json with project references**

`tsconfig.json`:
```json
{
  "files": [],
  "references": [
    { "path": "packages/shared" },
    { "path": "packages/mcp-server" }
  ]
}
```

Note: `packages/agent` is excluded because Next.js manages its own tsconfig and doesn't participate in `tsc --build` project references.

**Step 3: Commit**

```bash
git add tsconfig.base.json tsconfig.json
git commit -m "Add root TypeScript configs with project references"
```

---

### Task 3: packages/shared — empty TypeScript library

**Files:**
- Create: `packages/shared/package.json`
- Create: `packages/shared/tsconfig.json`
- Create: `packages/shared/src/index.ts`

**Step 1: Create package.json**

`packages/shared/package.json`:
```json
{
  "name": "@synthfinder/shared",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "exports": {
    ".": {
      "types": "./src/index.ts",
      "import": "./src/index.ts",
      "default": "./src/index.ts"
    }
  },
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "scripts": {
    "type-check": "tsc --noEmit"
  }
}
```

**Step 2: Create tsconfig.json**

`packages/shared/tsconfig.json`:
```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "composite": true,
    "outDir": "./dist",
    "rootDir": "./src"
  },
  "include": ["src/**/*"]
}
```

**Step 3: Create empty barrel export**

`packages/shared/src/index.ts`:
```ts
// @synthfinder/shared — domain types and interfaces
// Types will be added here as they emerge from TDD
```

**Step 4: Verify type-check passes**

Run: `cd packages/shared && npx tsc --noEmit`
Expected: No errors (empty project)

**Step 5: Commit**

```bash
git add packages/shared/
git commit -m "Add packages/shared — empty TypeScript library"
```

---

### Task 4: packages/mcp-server — empty TypeScript project

**Files:**
- Create: `packages/mcp-server/package.json`
- Create: `packages/mcp-server/tsconfig.json`
- Create: `packages/mcp-server/src/index.ts`

**Step 1: Create package.json**

`packages/mcp-server/package.json`:
```json
{
  "name": "@synthfinder/mcp-server",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "main": "./src/index.ts",
  "scripts": {
    "type-check": "tsc --noEmit"
  },
  "dependencies": {
    "@synthfinder/shared": "*"
  }
}
```

**Step 2: Create tsconfig.json**

`packages/mcp-server/tsconfig.json`:
```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "composite": true,
    "outDir": "./dist",
    "rootDir": "./src"
  },
  "include": ["src/**/*"],
  "references": [
    { "path": "../shared" }
  ]
}
```

**Step 3: Create empty entry point**

`packages/mcp-server/src/index.ts`:
```ts
// @synthfinder/mcp-server — MCP server for marketplace data access
```

**Step 4: Commit**

```bash
git add packages/mcp-server/
git commit -m "Add packages/mcp-server — empty TypeScript project"
```

---

### Task 5: packages/agent — Next.js App Router project

**Files:**
- Create: `packages/agent/` (via create-next-app)
- Modify: `packages/agent/package.json` (add shared dependency)
- Modify: `packages/agent/next.config.ts` (add transpilePackages)

**Step 1: Scaffold Next.js app**

Run:
```bash
npx create-next-app@latest packages/agent --typescript --eslint --app --src-dir --no-tailwind --use-npm --skip-install --disable-git
```

When prompted for import alias, accept the default `@/*`.

**Step 2: Add shared dependency to packages/agent/package.json**

Add to the `dependencies` object:
```json
"@synthfinder/shared": "*"
```

**Step 3: Configure transpilePackages in next.config.ts**

Replace the contents of `packages/agent/next.config.ts` with:
```ts
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@synthfinder/shared"],
};

export default nextConfig;
```

**Step 4: Create scripts directory**

```bash
mkdir packages/agent/scripts
```

Create `packages/agent/scripts/.gitkeep` (empty file — placeholder for scan.ts later).

**Step 5: Install all dependencies from root**

Run from project root:
```bash
npm install
```

This hoists all workspace dependencies and creates symlinks for local packages.

**Step 6: Verify Next.js dev server starts**

Run: `npm run dev`
Expected: Next.js dev server starts on http://localhost:3000, default page renders.
Stop the dev server after confirming.

**Step 7: Commit**

```bash
git add packages/agent/ package-lock.json
git commit -m "Add packages/agent — Next.js App Router project"
```

---

### Task 6: Vitest configuration

**Files:**
- Create: `vitest.config.mts`
- Create: `packages/shared/vitest.config.mts`
- Create: `packages/mcp-server/vitest.config.mts`
- Create: `packages/agent/vitest.config.mts`

**Step 1: Install Vitest dev dependencies at root**

```bash
npm install -D vitest vite-tsconfig-paths
```

**Step 2: Create root vitest config**

`vitest.config.mts`:
```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    projects: ["packages/*"],
  },
});
```

**Step 3: Create per-package configs**

`packages/shared/vitest.config.mts`:
```ts
import { defineProject } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineProject({
  plugins: [tsconfigPaths()],
  test: {
    environment: "node",
  },
});
```

`packages/mcp-server/vitest.config.mts`:
```ts
import { defineProject } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineProject({
  plugins: [tsconfigPaths()],
  test: {
    environment: "node",
  },
});
```

`packages/agent/vitest.config.mts`:
```ts
import { defineProject } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineProject({
  plugins: [tsconfigPaths()],
  test: {
    environment: "node",
  },
});
```

Note: Using `node` environment for agent too — we'll add `jsdom` and `@vitejs/plugin-react` only when we have React component tests.

**Step 4: Write a smoke test to verify Vitest works**

Create `packages/shared/src/index.test.ts`:
```ts
import { describe, it, expect } from "vitest";

describe("shared", () => {
  it("works", () => {
    expect(true).toBe(true);
  });
});
```

**Step 5: Run tests**

Run: `npm test`
Expected: 1 test passes

**Step 6: Remove smoke test**

Delete `packages/shared/src/index.test.ts` — it was only to verify the setup.

**Step 7: Commit**

```bash
git add vitest.config.mts packages/shared/vitest.config.mts packages/mcp-server/vitest.config.mts packages/agent/vitest.config.mts package.json package-lock.json
git commit -m "Add Vitest configuration with workspace projects"
```

---

### Task 7: ESLint + Prettier configuration

**Files:**
- Create: `eslint.config.mjs` (root)
- Create: `.prettierrc`
- Modify: `package.json` (install deps)
- Remove: `packages/agent/eslint.config.mjs` (move to root)

**Step 1: Install ESLint and Prettier dependencies**

```bash
npm install -D prettier eslint-config-prettier
```

Note: `eslint` and `eslint-config-next` are already installed by create-next-app.

**Step 2: Create root ESLint flat config**

`eslint.config.mjs`:
```js
import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __dirname = dirname(fileURLToPath(import.meta.url));
const compat = new FlatCompat({ baseDirectory: __dirname });

const eslintConfig = [
  ...compat.extends("next/core-web-vitals", "next/typescript", "prettier"),
  {
    ignores: [".next/", "out/", "dist/", "build/", "node_modules/"],
  },
  {
    settings: {
      next: {
        rootDir: "packages/agent/",
      },
    },
  },
];

export default eslintConfig;
```

Note: `next/core-web-vitals` and `next/typescript` need `settings.next.rootDir` to find the Next.js app in a monorepo. Check what create-next-app generated for `packages/agent/eslint.config.mjs` — if it uses a different pattern (e.g., direct imports vs FlatCompat), adapt the root config to match.

**Step 3: Remove the per-package ESLint config**

Delete `packages/agent/eslint.config.mjs` — the root config handles everything.

**Step 4: Create Prettier config**

`.prettierrc`:
```json
{
  "semi": true,
  "singleQuote": false,
  "trailingComma": "all",
  "printWidth": 100
}
```

**Step 5: Verify lint passes**

Run: `npm run lint`
Expected: No errors (or only auto-fixable warnings)

If there are errors from the generated Next.js code, fix with:
```bash
npm run lint:fix
```

**Step 6: Verify format passes**

Run: `npm run format:check`
Expected: All files formatted correctly (or fix with `npm run format`)

**Step 7: Commit**

```bash
git add eslint.config.mjs .prettierrc package.json package-lock.json
git rm packages/agent/eslint.config.mjs  # if it existed
git add -u  # stage any formatted file changes
git commit -m "Add root ESLint + Prettier configuration"
```

---

### Task 8: Update .gitignore and evals directory

**Files:**
- Modify: `.gitignore`
- Create: `evals/.gitkeep`
- Create: `output/.gitkeep`

**Step 1: Update .gitignore**

Add these entries to the existing `.gitignore`:
```
# Next.js
.next/
out/

# Output
output/*.json
output/*.txt
!output/.gitkeep
```

**Step 2: Create placeholder directories**

```bash
mkdir -p evals output
touch evals/.gitkeep output/.gitkeep
```

**Step 3: Commit**

```bash
git add .gitignore evals/.gitkeep output/.gitkeep
git commit -m "Update .gitignore for Next.js and add evals/output directories"
```

---

### Task 9: Update ADR-005 and add ADR-009

**Files:**
- Modify: `adr/005-tech-stack.md`
- Create: `adr/009-monorepo-workspaces.md`
- Modify: `README.md` (add ADR-009 to index)

**Step 1: Update ADR-005**

Change the Framework row in the table from "Deferred to post-MVP" to reflect Next.js from day one. Update the MVP-specific note and consequences accordingly.

**Step 2: Create ADR-009**

`adr/009-monorepo-workspaces.md`:

Document the decision to use npm workspaces with three packages (`shared`, `mcp-server`, `agent`). Context: agent and MCP server are independently runnable/deployable units that share domain types. Decision: monorepo with npm workspaces over single project or separate repos. Consequences: clean dependency boundaries, shared types without duplication, independent test suites, slightly more config overhead.

**Step 3: Add ADR-009 to README index**

Add to the index in `README.md`:
```
- [ADR-009: Monorepo with npm workspaces](./adr/009-monorepo-workspaces.md)
```

**Step 4: Commit**

```bash
git add adr/005-tech-stack.md adr/009-monorepo-workspaces.md README.md
git commit -m "Update ADR-005 (Next.js from day one) and add ADR-009 (monorepo)"
```

---

### Task 10: Update CLAUDE.md

**Files:**
- Modify: `CLAUDE.md`

**Step 1: Update CLAUDE.md**

Update to reflect the monorepo structure, revised commands, and workspace layout. Key changes:
- Project structure now shows `packages/` with three workspaces
- Commands updated (e.g., `npm run dev` runs the Next.js agent, `npm test` runs Vitest across all packages)
- Note that Next.js is included from day one
- Add monorepo workspace info

**Step 2: Commit**

```bash
git add CLAUDE.md
git commit -m "Update CLAUDE.md for monorepo structure"
```

---

### Task 11: Final verification

**Step 1: Run all checks from root**

```bash
npm run type-check
npm run lint
npm run format:check
npm test
```

Expected: All pass with zero errors.

**Step 2: Verify dev server**

```bash
npm run dev
```

Expected: Next.js starts on localhost:3000, default page renders. Stop after confirming.

No commit — this is just verification.
