import { ExecutorContext } from "@nx/devkit";
import { beforeEach, describe, expect, it, vi } from "vitest";

const spawnSyncMock = vi.hoisted(() => vi.fn());

vi.mock("child_process", () => ({
  spawnSync: spawnSyncMock,
}));

import executor from "./add";
import { AddExecutorSchema } from "./schema";

const context: ExecutorContext = {
  root: "/repo",
  cwd: "/repo",
  isVerbose: false,
  projectName: "shared",
  projectGraph: {
    nodes: {},
    dependencies: {},
  },
  projectsConfigurations: {
    version: 2,
    projects: {
      shared: {
        root: "packages/py/shared",
        sourceRoot: "packages/py/shared/src",
        projectType: "library",
        targets: {},
      },
    },
  },
  nxJsonConfiguration: {},
};

function mockUvSuccess() {
  spawnSyncMock.mockImplementation((_command: string, args: string[]) => {
    if (args[0] === "--version") {
      return {
        status: 0,
        stdout: "uv 0.9.29\n",
        stderr: "",
        pid: 1,
        output: [],
        signal: null,
      };
    }

    return {
      status: 0,
      stdout: "",
      stderr: "",
      pid: 1,
      output: [],
      signal: null,
    };
  });
}

describe("add executor", () => {
  beforeEach(() => {
    spawnSyncMock.mockReset();
    mockUvSuccess();
  });

  it("fails when no dependencies are provided", async () => {
    const result = await executor(
      {
        dependencies: [],
      } as AddExecutorSchema,
      context,
    );

    expect(result.success).toBe(false);
    expect(spawnSyncMock).not.toHaveBeenCalled();
  });

  it("runs uv add command with options and dependencies", async () => {
    const options: AddExecutorSchema = {
      package: "shared",
      dev: true,
      group: "test",
      extraArgs: ["--optional"],
      dependencies: ["ruff", "pytest"],
    };

    const result = await executor(options, context);

    expect(result.success).toBe(true);
    expect(spawnSyncMock).toHaveBeenNthCalledWith(
      2,
      "uv",
      [
        "add",
        "--package",
        "shared",
        "--dev",
        "--group",
        "test",
        "ruff",
        "pytest",
        "--optional",
      ],
      expect.objectContaining({
        cwd: "/repo/packages/py/shared",
      }),
    );
  });

  it("runs uv add with only dependency arguments", async () => {
    const options: AddExecutorSchema = {
      dependencies: ["httpx"],
    };

    const result = await executor(options, context);

    expect(result.success).toBe(true);
    expect(spawnSyncMock).toHaveBeenNthCalledWith(
      2,
      "uv",
      ["add", "httpx"],
      expect.objectContaining({
        cwd: "/repo/packages/py/shared",
      }),
    );
  });
});
