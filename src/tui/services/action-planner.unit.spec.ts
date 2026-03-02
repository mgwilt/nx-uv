import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import {
  actionIsMutating,
  planConvertGenerator,
  planInferencePatch,
  planIntegrationGenerator,
  planProjectGenerator,
  planRunTarget,
  planRunUv,
  planWorkspaceGenerator,
} from "./action-planner";

const tempRoots: string[] = [];

function createWorkspace(nxJson: Record<string, unknown> = {}): string {
  const root = mkdtempSync(join(tmpdir(), "nx-uv-tui-plan-"));
  tempRoots.push(root);
  writeFileSync(
    join(root, "nx.json"),
    `${JSON.stringify(nxJson, null, 2)}\n`,
    "utf-8",
  );
  return root;
}

afterEach(() => {
  while (tempRoots.length > 0) {
    const root = tempRoots.pop();
    if (root) {
      rmSync(root, { recursive: true, force: true });
    }
  }
});

describe("tui action planner", () => {
  it("builds workspace generator preview/apply commands", () => {
    const workspaceRoot = createWorkspace();

    const plan = planWorkspaceGenerator(workspaceRoot, {
      membersGlob: "packages/py/*",
      targetPrefix: "uv:",
      inferencePreset: "standard",
      includeGlobalTargets: true,
      skipFormat: true,
    });

    expect(plan.kind).toBe("command");
    expect(plan.mutatesRepo).toBe(true);
    expect(plan.apply.args.join(" ")).toContain("g @mgwilt/nx-uv:workspace");
    expect(plan.apply.args).toEqual(
      expect.arrayContaining([
        "--membersGlob=packages/py/*",
        "--targetPrefix=uv:",
        "--inferencePreset=standard",
        "--includeGlobalTargets=true",
        "--skipFormat=true",
      ]),
    );
    expect(plan.preview?.args).toEqual(
      expect.arrayContaining(["--dry-run", "--no-interactive"]),
    );
  });

  it("supports positional project name for project generator and drops empty flags", () => {
    const workspaceRoot = createWorkspace();

    const plan = planProjectGenerator(workspaceRoot, {
      name: "services/api",
      projectType: "app",
      directory: "packages/py",
      moduleName: "",
      tags: "",
      withTests: false,
      workspaceMember: true,
    });

    expect(plan.apply.args).toEqual(
      expect.arrayContaining(["g", "@mgwilt/nx-uv:project", "services/api"]),
    );
    expect(plan.apply.args).toEqual(
      expect.arrayContaining([
        "--projectType=app",
        "--directory=packages/py",
        "--withTests=false",
        "--workspaceMember=true",
      ]),
    );
    expect(plan.apply.args).not.toContain("--moduleName=");
    expect(plan.apply.args).not.toContain("--tags=");
  });

  it("handles missing project name values without injecting a positional argument", () => {
    const workspaceRoot = createWorkspace();

    const plan = planProjectGenerator(workspaceRoot, {
      name: undefined,
      projectType: "lib",
    });

    expect(plan.apply.args).toEqual(
      expect.arrayContaining(["g", "@mgwilt/nx-uv:project"]),
    );
    expect(plan.apply.args).not.toEqual(expect.arrayContaining(["undefined"]));
  });

  it("builds integration and convert generator commands", () => {
    const workspaceRoot = createWorkspace();

    const integration = planIntegrationGenerator(workspaceRoot, {
      template: "fastapi",
      project: "api",
      overwrite: true,
    });

    const convert = planConvertGenerator(workspaceRoot, {
      project: "api",
      skipFormat: true,
    });

    expect(integration.apply.args.join(" ")).toContain(
      "g @mgwilt/nx-uv:integration",
    );
    expect(integration.apply.args).toEqual(
      expect.arrayContaining([
        "--template=fastapi",
        "--project=api",
        "--overwrite=true",
      ]),
    );

    expect(convert.apply.args.join(" ")).toContain("g @mgwilt/nx-uv:convert");
    expect(convert.apply.args).toEqual(
      expect.arrayContaining(["--project=api", "--skipFormat=true"]),
    );
  });

  it("builds run target plans with and without configuration", () => {
    const workspaceRoot = createWorkspace();

    const configured = planRunTarget(workspaceRoot, {
      project: "api",
      target: "test",
      configuration: "ci",
      args: "-- --coverage",
    });

    const plain = planRunTarget(workspaceRoot, {
      project: "api",
      target: "build",
      configuration: "",
      args: "",
    });

    expect(configured.mutatesRepo).toBe(false);
    expect(configured.apply.args).toEqual(
      expect.arrayContaining(["run", "api:test:ci", "--", "--coverage"]),
    );

    expect(plain.apply.args).toEqual(
      expect.arrayContaining(["run", "api:build"]),
    );
    expect(plain.apply.args).not.toContain("api:build:");
  });

  it("handles run target defaults when values are undefined", () => {
    const workspaceRoot = createWorkspace();

    const plan = planRunTarget(workspaceRoot, {
      project: undefined,
      target: undefined,
      configuration: undefined,
      args: undefined,
    });

    expect(plan.apply.args).toEqual(expect.arrayContaining(["run", ":"]));
  });

  it("builds uv run plans and resolves optional cwd", () => {
    const workspaceRoot = createWorkspace();

    const withCwd = planRunUv(workspaceRoot, {
      args: "cache size",
      cwd: "packages/py/api",
    });

    const withoutCwd = planRunUv(workspaceRoot, {
      args: "self version",
      cwd: "",
    });

    expect(withCwd.apply.command).toBe("uv");
    expect(withCwd.apply.args).toEqual(["cache", "size"]);
    expect(withCwd.apply.cwd).toBe(join(workspaceRoot, "packages/py/api"));

    expect(withoutCwd.apply.args).toEqual(["self", "version"]);
    expect(withoutCwd.apply.cwd).toBe(workspaceRoot);
  });

  it("handles undefined uv args and cwd values", () => {
    const workspaceRoot = createWorkspace();

    const plan = planRunUv(workspaceRoot, {
      args: undefined,
      cwd: undefined,
    });

    expect(plan.apply.args).toEqual([]);
    expect(plan.apply.cwd).toBe(workspaceRoot);
  });

  it("creates nx.json patch when plugin is represented as a string entry", () => {
    const workspaceRoot = createWorkspace({
      plugins: ["@mgwilt/nx-uv"],
    });

    const patch = planInferencePatch(workspaceRoot, {
      targetPrefix: "uv:",
      inferencePreset: "full",
      includeGlobalTargets: true,
      inferredTargetsJson: '{"test":false}',
    });

    expect(patch.kind).toBe("patch");
    expect(patch.after).toContain('"inferencePreset": "full"');
    expect(patch.after).toContain('"includeGlobalTargets": true');
    expect(patch.after).toContain('"inferredTargets"');

    const onDisk = readFileSync(join(workspaceRoot, "nx.json"), "utf-8");
    expect(onDisk).not.toContain('"inferencePreset": "full"');
  });

  it("uses default inference values when options are omitted", () => {
    const workspaceRoot = createWorkspace({
      plugins: ["@mgwilt/nx-uv"],
    });

    const patch = planInferencePatch(workspaceRoot, {
      targetPrefix: undefined,
      inferencePreset: undefined,
      includeGlobalTargets: undefined,
    });

    expect(patch.after).toContain('"targetPrefix": "uv:"');
    expect(patch.after).toContain('"inferencePreset": "standard"');
    expect(patch.after).toContain('"includeGlobalTargets": false');
  });

  it("adds plugin entry when missing", () => {
    const workspaceRoot = createWorkspace({ plugins: [] });

    const patch = planInferencePatch(workspaceRoot, {
      targetPrefix: "uv2:",
      inferencePreset: "minimal",
      includeGlobalTargets: false,
      inferredTargetsJson: "",
    });

    expect(patch.after).toContain('"plugin": "@mgwilt/nx-uv"');
    expect(patch.after).toContain('"targetPrefix": "uv2:"');
    expect(patch.after).not.toContain('"inferredTargets"');
  });

  it("merges with an existing object plugin entry and preserves unknown options", () => {
    const workspaceRoot = createWorkspace({
      plugins: [
        {
          plugin: "@mgwilt/nx-uv",
          options: {
            includeGlobalTargets: false,
            customFlag: "keep-me",
          },
        },
      ],
    });

    const patch = planInferencePatch(workspaceRoot, {
      targetPrefix: "uv:",
      inferencePreset: "standard",
      includeGlobalTargets: "true",
      inferredTargetsJson: "",
    });

    expect(patch.after).toContain('"customFlag": "keep-me"');
    expect(patch.after).toContain('"includeGlobalTargets": true');
  });

  it("handles existing object plugin entries without options", () => {
    const workspaceRoot = createWorkspace({
      plugins: [
        {
          plugin: "@mgwilt/nx-uv",
        },
      ],
    });

    const patch = planInferencePatch(workspaceRoot, {
      includeGlobalTargets: true,
    });

    expect(patch.after).toContain('"includeGlobalTargets": true');
  });

  it("skips undefined workspace generator flags", () => {
    const workspaceRoot = createWorkspace();

    const plan = planWorkspaceGenerator(workspaceRoot, {
      membersGlob: undefined,
      targetPrefix: "uv:",
    });

    expect(plan.apply.args).not.toEqual(
      expect.arrayContaining(["--membersGlob=undefined"]),
    );
    expect(plan.apply.args).toEqual(
      expect.arrayContaining(["--targetPrefix=uv:"]),
    );
  });

  it("generates a diff when nx.json normalizes to fewer lines", () => {
    const workspaceRoot = mkdtempSync(join(tmpdir(), "nx-uv-tui-plan-diff-"));
    tempRoots.push(workspaceRoot);
    writeFileSync(
      join(workspaceRoot, "nx.json"),
      `{\n  "plugins": [\n    "@mgwilt/nx-uv"\n  ]\n}\n\n\n`,
      "utf-8",
    );

    const patch = planInferencePatch(workspaceRoot, {
      targetPrefix: "uv:",
    });

    expect(patch.diff).toContain("--- before");
    expect(patch.diff).toContain("+++ after");
  });

  it("throws when nx.json is missing", () => {
    const workspaceRoot = mkdtempSync(join(tmpdir(), "nx-uv-tui-no-nx-"));
    tempRoots.push(workspaceRoot);

    expect(() =>
      planInferencePatch(workspaceRoot, {
        targetPrefix: "uv:",
      }),
    ).toThrow("nx.json not found");
  });

  it("reports mutating vs non-mutating actions", () => {
    const workspaceRoot = createWorkspace();
    const commandAction = planRunTarget(workspaceRoot, {
      project: "api",
      target: "test",
      configuration: "",
      args: "",
    });

    const patchAction = planInferencePatch(workspaceRoot, {
      targetPrefix: "uv:",
    });

    expect(actionIsMutating(commandAction)).toBe(false);
    expect(actionIsMutating(patchAction)).toBe(true);
  });
});
