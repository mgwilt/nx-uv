import { readJson, Tree } from "@nx/devkit";
import { createTreeWithEmptyWorkspace } from "@nx/devkit/testing";

import { workspaceGenerator } from "./workspace";

describe("workspace generator", () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
  });

  it("creates root pyproject workspace config and nx plugin options", async () => {
    await workspaceGenerator(tree, {
      name: "mono space",
      membersGlob: "packages/python/*",
      exclude: "packages/python/legacy, packages/python/tmp",
      targetPrefix: "uv:",
      inferencePreset: "full",
      includeGlobalTargets: true,
      skipFormat: true,
    });

    const pyproject = tree.read("pyproject.toml", "utf-8") ?? "";
    const nxJson = readJson(tree, "nx.json");

    expect(pyproject).toContain('name = "mono-space"');
    expect(pyproject).toContain("[tool.uv.workspace]");
    expect(pyproject).toContain('members = ["packages/python/*"]');
    expect(pyproject).toContain(
      'exclude = ["packages/python/legacy", "packages/python/tmp"]',
    );
    expect(nxJson.plugins).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          plugin: "@mgwilt/nx-uv",
          options: {
            targetPrefix: "uv:",
            inferencePreset: "full",
            includeGlobalTargets: true,
          },
        }),
      ]),
    );
  });

  it("appends workspace table when pyproject exists without workspace metadata", async () => {
    tree.write(
      "pyproject.toml",
      ["[project]", 'name = "existing"', 'version = "0.1.0"', ""].join("\n"),
    );

    await workspaceGenerator(tree, {
      membersGlob: "apps/*",
      skipFormat: true,
    });

    const pyproject = tree.read("pyproject.toml", "utf-8") ?? "";

    expect(pyproject).toContain("[tool.uv.workspace]");
    expect(pyproject).toContain('members = ["apps/*"]');
  });

  it("does not duplicate workspace table when it already exists", async () => {
    tree.write(
      "pyproject.toml",
      [
        "[project]",
        'name = "existing"',
        "",
        "[tool.uv.workspace]",
        'members = ["packages/*"]',
        "",
      ].join("\n"),
    );

    await workspaceGenerator(tree, {
      membersGlob: "apps/*",
      skipFormat: true,
    });

    const pyproject = tree.read("pyproject.toml", "utf-8") ?? "";

    const tableOccurrences = pyproject.match(/\[tool\.uv\.workspace\]/g) ?? [];
    expect(tableOccurrences).toHaveLength(1);
    expect(pyproject).not.toContain('members = ["apps/*"]');
  });
});
