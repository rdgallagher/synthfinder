import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import prettierConfig from "eslint-config-prettier";

const agentFiles = ["packages/agent/**/*.{ts,tsx,js,jsx,mjs}"];
const nextSettings = { next: { rootDir: "packages/agent/" } };

const eslintConfig = defineConfig([
  ...nextVitals.map((config) => ({
    ...config,
    files: agentFiles,
    settings: { ...config.settings, ...nextSettings },
  })),
  ...nextTs.map((config) => ({
    ...config,
    files: agentFiles,
    settings: { ...config.settings, ...nextSettings },
  })),
  prettierConfig,
  globalIgnores([
    "**/.next/**",
    "**/out/**",
    "**/dist/**",
    "**/build/**",
    "**/node_modules/**",
  ]),
]);

export default eslintConfig;
