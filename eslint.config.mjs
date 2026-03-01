import nx from "@nx/eslint-plugin";

export default [
  {
    files: ["**/*.json"],
    rules: {},
    languageOptions: {
      parser: await import("jsonc-eslint-parser"),
    },
  },
  ...nx.configs["flat/base"],
  ...nx.configs["flat/typescript"],
  ...nx.configs["flat/javascript"],
  {
    ignores: ["**/dist", "**/out-tsc", "**/vitest.config.*.timestamp*"],
  },
  {
    files: ["**/package.json", "**/executors.json", "**/generators.json"],
    rules: {
      "@nx/nx-plugin-checks": "error",
    },
    languageOptions: {
      parser: await import("jsonc-eslint-parser"),
    },
  },
  {
    files: ["**/*.json"],
    rules: {
      "@nx/dependency-checks": [
        "error",
        {
          ignoredFiles: [
            "{projectRoot}/eslint.config.{js,cjs,mjs,ts,cts,mts}",
            "{projectRoot}/vite.config.{js,ts,mjs,mts}",
          ],
        },
      ],
    },
    languageOptions: {
      parser: await import("jsonc-eslint-parser"),
    },
  },
];
