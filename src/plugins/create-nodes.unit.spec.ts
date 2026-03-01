import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { createNodesV2 } from "./create-nodes";

const tempRoots: string[] = [];

function createWorkspace(files: Record<string, string>): string {
  const workspaceRoot = mkdtempSync(join(tmpdir(), "nx-uv-create-nodes-"));
  tempRoots.push(workspaceRoot);

  for (const [relativePath, content] of Object.entries(files)) {
    const absolutePath = join(workspaceRoot, relativePath);
    mkdirSync(dirname(absolutePath), { recursive: true });
    writeFileSync(absolutePath, content, "utf-8");
  }

  return workspaceRoot;
}

afterEach(() => {
  while (tempRoots.length > 0) {
    const root = tempRoots.pop();
    if (root) {
      rmSync(root, { recursive: true, force: true });
    }
  }
});

describe("createNodesV2", () => {
  it("infers standard targets from pyproject project metadata", async () => {
    const workspaceRoot = createWorkspace({
      "packages/lib-one/pyproject.toml": `[project]\nname = "Lib One"\n`,
    });

    const [, createNodes] = createNodesV2;
    const results = await createNodes(
      ["packages/lib-one/pyproject.toml"],
      {
        targetPrefix: "uv:",
        inferencePreset: "standard",
      },
      {
        workspaceRoot,
        nxJsonConfiguration: {},
      },
    );

    expect(results).toHaveLength(1);

    const [, result] = results[0];
    const inferred = result.projects?.["packages/lib-one"];

    expect(inferred?.name).toBe("lib-one");
    expect(inferred?.targets).toEqual(
      expect.objectContaining({
        "uv:sync": expect.any(Object),
        "uv:run": expect.any(Object),
        "uv:lock": expect.any(Object),
        "uv:test": expect.any(Object),
        "uv:lint": expect.any(Object),
        "uv:build": expect.any(Object),
        "uv:tree": expect.any(Object),
      }),
    );
    expect(inferred?.targets?.["uv:publish"]).toBeUndefined();
    expect(inferred?.metadata).toMatchObject({
      technology: "python",
      tool: "uv",
    });
  });

  it("adds full preset targets and global workspace targets when enabled", async () => {
    const workspaceRoot = createWorkspace({
      "pyproject.toml": `[tool.uv.workspace]\nmembers = ["packages/*"]\n`,
    });

    const [, createNodes] = createNodesV2;
    const results = await createNodes(
      ["pyproject.toml"],
      {
        targetPrefix: "uv:",
        inferencePreset: "full",
        includeGlobalTargets: true,
      },
      {
        workspaceRoot,
        nxJsonConfiguration: {},
      },
    );

    const [, result] = results[0];
    const inferred = result.projects?.["."];

    expect(inferred?.name).toBe("python-workspace");
    expect(inferred?.targets).toEqual(
      expect.objectContaining({
        "uv:export": expect.any(Object),
        "uv:format": expect.any(Object),
        "uv:venv": expect.any(Object),
        "uv:publish": expect.any(Object),
        "uv:python:list": expect.any(Object),
        "uv:tool:list": expect.any(Object),
        "uv:cache:size": expect.any(Object),
        "uv:self:version": expect.any(Object),
      }),
    );
  });

  it("falls back to sanitized directory name when project metadata is absent", async () => {
    const workspaceRoot = createWorkspace({
      "apps/My Service/pyproject.toml": `[tool.ruff]\nline-length = 100\n`,
    });

    const [, createNodes] = createNodesV2;
    const results = await createNodes(
      ["apps/My Service/pyproject.toml"],
      {
        targetPrefix: "uv:",
        inferencePreset: "minimal",
      },
      {
        workspaceRoot,
        nxJsonConfiguration: {},
      },
    );

    const [, result] = results[0];
    const inferred = result.projects?.["apps/My Service"];

    expect(inferred?.name).toBe("my-service");
    expect(inferred?.targets).toEqual(
      expect.objectContaining({
        "uv:sync": expect.any(Object),
        "uv:run": expect.any(Object),
      }),
    );
    expect(inferred?.targets?.["uv:lock"]).toBeUndefined();
  });

  it("parses project names declared with single quotes", async () => {
    const workspaceRoot = createWorkspace({
      "packages/single-quote/pyproject.toml": `[project]\nname = 'Single Quote'\n`,
    });

    const [, createNodes] = createNodesV2;
    const results = await createNodes(
      ["packages/single-quote/pyproject.toml"],
      undefined,
      {
        workspaceRoot,
        nxJsonConfiguration: {},
      },
    );

    const [, result] = results[0];
    const inferred = result.projects?.["packages/single-quote"];

    expect(inferred?.name).toBe("single-quote");
    expect(inferred?.targets).toEqual(
      expect.objectContaining({
        "uv:sync": expect.any(Object),
        "uv:run": expect.any(Object),
      }),
    );
  });

  it("does not add global targets when workspace root is not inferred or workspace table is missing", async () => {
    const workspaceRoot = createWorkspace({
      "apps/service/pyproject.toml": `[project]\nname = "Service"\n`,
      "pyproject.toml": `[project]\nname = "workspace"\n`,
    });

    const [, createNodes] = createNodesV2;

    const appResult = await createNodes(
      ["apps/service/pyproject.toml"],
      {
        includeGlobalTargets: true,
        inferencePreset: "full",
      },
      {
        workspaceRoot,
        nxJsonConfiguration: {},
      },
    );

    const rootResult = await createNodes(
      ["pyproject.toml"],
      {
        includeGlobalTargets: true,
        inferencePreset: "full",
      },
      {
        workspaceRoot,
        nxJsonConfiguration: {},
      },
    );

    const [, appNodeResult] = appResult[0];
    const [, rootNodeResult] = rootResult[0];

    expect(
      appNodeResult.projects?.["apps/service"]?.targets?.["uv:python:list"],
    ).toBeUndefined();
    expect(
      rootNodeResult.projects?.["."]?.targets?.["uv:python:list"],
    ).toBeUndefined();
  });
});
