import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  globalIgnores([
    // Build output and generated files
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Third-party map worker copied from node_modules
    "public/maplibre-gl-worker.mjs",
  ]),
]);

export default eslintConfig;
