import { ExecutorContext } from "@nx/devkit";
import { beforeEach, describe, expect, it, vi } from "vitest";

const spawnSyncMock = vi.hoisted(() => vi.fn());

vi.mock("child_process", () => ({
  spawnSync: spawnSyncMock,
}));

import executor from "./run";
import { RunExecutorSchema } from "./schema";

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

describe("run executor", () => {
  beforeEach(() => {
    spawnSyncMock.mockReset();
    mockUvSuccess();
  });

  it("fails when command is empty", async () => {
    const result = await executor(
      {
        command: "",
      } as RunExecutorSchema,
      context,
    );

    expect(result.success).toBe(false);
    expect(spawnSyncMock).not.toHaveBeenCalled();
  });

  it("runs uv run with package, python, and dependency overrides", async () => {
    const options: RunExecutorSchema = {
      cwd: "packages/py/shared",
      package: "shared",
      python: "3.12",
      with: ["ruff", "pytest"],
      extraArgs: ["--isolated"],
      command: "pytest",
      args: ["-q"],
    };

    const result = await executor(options, context);

    expect(result.success).toBe(true);
    expect(spawnSyncMock).toHaveBeenNthCalledWith(
      2,
      "uv",
      [
        "run",
        "--package",
        "shared",
        "--python",
        "3.12",
        "--with",
        "ruff",
        "--with",
        "pytest",
        "--",
        "pytest",
        "-q",
        "--isolated",
      ],
      expect.objectContaining({
        cwd: "/repo/packages/py/shared",
      }),
    );
  });

  it("runs uv run with only the required command", async () => {
    const options: RunExecutorSchema = {
      command: "python",
    };

    const result = await executor(options, context);

    expect(result.success).toBe(true);
    expect(spawnSyncMock).toHaveBeenNthCalledWith(
      2,
      "uv",
      ["run", "--", "python"],
      expect.objectContaining({
        cwd: "/repo/packages/py/shared",
      }),
    );
  });
});
