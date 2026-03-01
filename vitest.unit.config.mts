import { defineConfig } from "vitest/config";
import { nxViteTsPaths } from "@nx/vite/plugins/nx-tsconfig-paths.plugin";
import { nxCopyAssetsPlugin } from "@nx/vite/plugins/nx-copy-assets.plugin";

export default defineConfig(() => ({
  root: __dirname,
  cacheDir: "node_modules/.vite",
  plugins: [nxViteTsPaths(), nxCopyAssetsPlugin(["*.md"])],
  test: {
    name: "nx-uv-unit",
    watch: false,
    globals: true,
    environment: "node",
    include: ["src/**/*.unit.spec.ts"],
    reporters: ["default"],
  },
}));
