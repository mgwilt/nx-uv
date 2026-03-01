import { readProjectConfiguration, Tree } from "@nx/devkit";
import { createTreeWithEmptyWorkspace } from "@nx/devkit/testing";

import { projectGenerator } from "./project";

describe("project generator", () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
  });

  it("creates a library project and removes app main entrypoint", async () => {
    await projectGenerator(tree, {
      name: "shared",
      projectType: "lib",
      skipFormat: true,
    });

    const config = readProjectConfiguration(tree, "shared");

    expect(config.projectType).toBe("library");
    expect(config.targets).toEqual(
      expect.objectContaining({
        sync: expect.any(Object),
        lock: expect.any(Object),
        uv: expect.any(Object),
      }),
    );
    expect(tree.exists("packages/py/shared/src/shared/main.py")).toBe(false);
    expect(tree.exists("packages/py/shared/tests/test_smoke.py")).toBe(true);
  });

  it("supports nested names, directory inference, and module name overrides", async () => {
    await projectGenerator(tree, {
      name: "services/api-service",
      moduleName: "API Client",
      tags: "backend,python",
      withTests: false,
      skipFormat: true,
    });

    const config = readProjectConfiguration(tree, "api-service");

    expect(config.root).toBe("services/api-service");
    expect(config.tags).toEqual(["backend", "python"]);
    expect(tree.exists("services/api-service/src/api_client/__init__.py")).toBe(
      true,
    );
    expect(tree.exists("services/api-service/tests/test_smoke.py")).toBe(false);
  });

  it("creates script projects without package test scaffolding", async () => {
    await projectGenerator(tree, {
      name: "hello-script",
      projectType: "script",
      skipFormat: true,
    });

    const config = readProjectConfiguration(tree, "hello-script");

    expect(config.projectType).toBe("library");
    expect(tree.exists("packages/py/hello-script/main.py")).toBe(true);
    expect(tree.exists("packages/py/hello-script/tests/test_smoke.py")).toBe(
      false,
    );
  });

  it("adds workspace membership when root pyproject exists and workspace is absent", async () => {
    tree.write(
      "pyproject.toml",
      ["[project]", 'name = "workspace"', 'version = "0.1.0"', ""].join("\n"),
    );

    await projectGenerator(tree, {
      name: "member-project",
      workspaceMember: true,
      skipFormat: true,
    });

    const pyproject = tree.read("pyproject.toml", "utf-8") ?? "";

    expect(pyproject).toContain("[tool.uv.workspace]");
    expect(pyproject).toContain('members = ["packages/py/member-project"]');
  });

  it("does not mutate root pyproject when workspace membership is disabled", async () => {
    tree.write(
      "pyproject.toml",
      ["[project]", 'name = "workspace"', 'version = "0.1.0"', ""].join("\n"),
    );

    await projectGenerator(tree, {
      name: "standalone",
      workspaceMember: false,
      skipFormat: true,
    });

    const pyproject = tree.read("pyproject.toml", "utf-8") ?? "";

    expect(pyproject).not.toContain("[tool.uv.workspace]");
  });
});
