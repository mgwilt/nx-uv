import { defineConfig } from "vitest/config";
import { nxViteTsPaths } from "@nx/vite/plugins/nx-tsconfig-paths.plugin";

export default defineConfig(() => ({
  root: __dirname,
  cacheDir: "node_modules/.vite",
  plugins: [nxViteTsPaths()],
  test: {
    name: "nx-uv-e2e",
    watch: false,
    globals: true,
    environment: "node",
    include: ["e2e/**/*.e2e.spec.ts"],
    testTimeout: 120000,
    hookTimeout: 120000,
    reporters: ["default"],
  },
}));
