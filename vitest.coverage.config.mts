import { defineConfig } from "vitest/config";
import { nxViteTsPaths } from "@nx/vite/plugins/nx-tsconfig-paths.plugin";
import { nxCopyAssetsPlugin } from "@nx/vite/plugins/nx-copy-assets.plugin";

export default defineConfig(() => ({
  root: __dirname,
  cacheDir: "node_modules/.vite",
  plugins: [nxViteTsPaths(), nxCopyAssetsPlugin(["*.md"])],
  test: {
    name: "nx-uv-coverage",
    watch: false,
    globals: true,
    environment: "node",
    include: ["src/**/*.unit.spec.ts", "src/**/*.int.spec.ts"],
    reporters: ["default"],
    coverage: {
      enabled: true,
      provider: "v8" as const,
      reportsDirectory: "coverage",
      reporter: ["text-summary", "lcov", "json-summary"],
      reportOnFailure: true,
      // Interactive Ink screens are validated through integration smoke runs and
      // command/service unit tests; excluding render-heavy views keeps thresholds
      // aligned with deterministic logic coverage gates.
      exclude: [
        "src/bin/nx-uv.ts",
        "src/tui/app.tsx",
        "src/tui/components/**",
        "src/tui/index.ts",
      ],
      thresholds: {
        lines: 95,
        functions: 95,
        statements: 95,
        branches: 90,
      },
    },
  },
}));
