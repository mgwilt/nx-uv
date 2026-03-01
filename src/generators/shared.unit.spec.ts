import { readJson, Tree } from "@nx/devkit";
import { createTreeWithEmptyWorkspace } from "@nx/devkit/testing";

import {
  defaultUvTargets,
  ensureNxUvPlugin,
  normalizePythonProjectName,
  parseTags,
  readNxProjectMap,
  relativeToWorkspaceRoot,
  toModuleName,
} from "./shared";

describe("generator shared helpers", () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
  });

  it("normalizes project and module names", () => {
    expect(normalizePythonProjectName("My Cool App")).toBe("my-cool-app");
    expect(toModuleName("My Cool App")).toBe("my_cool_app");
  });

  it("parses tags from a csv string", () => {
    expect(parseTags(undefined)).toEqual([]);
    expect(parseTags(" api,backend, , workers ")).toEqual([
      "api",
      "backend",
      "workers",
    ]);
  });

  it("builds default uv targets for a project root", () => {
    const targets = defaultUvTargets("packages/py/shared");

    expect(Object.keys(targets)).toEqual([
      "sync",
      "lock",
      "tree",
      "run",
      "test",
      "lint",
      "format",
      "build",
    ]);
    expect(targets.sync).toMatchObject({
      executor: "@mgwilt/nx-uv:project",
      options: {
        cwd: "packages/py/shared",
        command: "sync",
      },
    });
    expect(targets.test).toMatchObject({
      options: {
        commandArgs: ["--", "pytest", "-q"],
      },
    });
  });

  it("adds nx-uv plugin entry when absent", () => {
    ensureNxUvPlugin(tree, {
      targetPrefix: "uv:",
      inferencePreset: "standard",
      includeGlobalTargets: true,
    });

    const nxJson = readJson(tree, "nx.json");

    expect(nxJson.plugins).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          plugin: "@mgwilt/nx-uv",
          options: {
            targetPrefix: "uv:",
            inferencePreset: "standard",
            includeGlobalTargets: true,
          },
        }),
      ]),
    );
  });

  it("upgrades string plugin entries into object entries", () => {
    tree.write(
      "nx.json",
      JSON.stringify(
        {
          plugins: ["@mgwilt/nx-uv"],
        },
        null,
        2,
      ),
    );

    ensureNxUvPlugin(tree, {
      targetPrefix: "uvx:",
      inferencePreset: "minimal",
      includeGlobalTargets: false,
    });

    const nxJson = readJson(tree, "nx.json");

    expect(nxJson.plugins).toEqual([
      {
        plugin: "@mgwilt/nx-uv",
        options: {
          targetPrefix: "uvx:",
          inferencePreset: "minimal",
          includeGlobalTargets: false,
        },
      },
    ]);
  });

  it("merges existing plugin options instead of replacing unrelated fields", () => {
    tree.write(
      "nx.json",
      JSON.stringify(
        {
          plugins: [
            {
              plugin: "@mgwilt/nx-uv",
              options: {
                includeGlobalTargets: false,
                customFlag: true,
              },
              include: ["packages/**"],
            },
          ],
        },
        null,
        2,
      ),
    );

    ensureNxUvPlugin(tree, {
      targetPrefix: "uv:",
      inferencePreset: "full",
      includeGlobalTargets: true,
    });

    const nxJson = readJson(tree, "nx.json");

    expect(nxJson.plugins).toEqual([
      {
        plugin: "@mgwilt/nx-uv",
        include: ["packages/**"],
        options: {
          customFlag: true,
          targetPrefix: "uv:",
          inferencePreset: "full",
          includeGlobalTargets: true,
        },
      },
    ]);
  });

  it("is a no-op when nx.json is missing", () => {
    tree.delete("nx.json");

    ensureNxUvPlugin(tree, {
      targetPrefix: "uv:",
      inferencePreset: "standard",
      includeGlobalTargets: false,
    });

    expect(tree.exists("nx.json")).toBe(false);
  });

  it("resolves paths relative to workspace root and reads nx project maps", () => {
    tree.write(
      "nx.json",
      JSON.stringify(
        {
          projects: {
            app: {
              root: "apps/app",
            },
            lib: {
              root: "libs/lib",
            },
          },
        },
        null,
        2,
      ),
    );

    expect(relativeToWorkspaceRoot("./apps/app")).toBe("apps/app");
    expect(readNxProjectMap(tree)).toEqual({
      app: {
        root: "apps/app",
      },
      lib: {
        root: "libs/lib",
      },
    });
  });

  it("returns an empty project map when nx.json is absent", () => {
    tree.delete("nx.json");
    expect(readNxProjectMap(tree)).toEqual({});
  });
});
