import { ExecutorContext } from "@nx/devkit";
import { beforeEach, describe, expect, it, vi } from "vitest";

const spawnSyncMock = vi.hoisted(() => vi.fn());

vi.mock("child_process", () => ({
  spawnSync: spawnSyncMock,
}));

import executor from "./pip";
import { PipExecutorSchema } from "./schema";

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

describe("pip executor", () => {
  beforeEach(() => {
    spawnSyncMock.mockReset();
    mockUvSuccess();
  });

  it("runs uv pip command with args", async () => {
    const options: PipExecutorSchema = {
      command: "list",
      commandArgs: ["--format", "json"],
    };

    const result = await executor(options, context);

    expect(result.success).toBe(true);
    expect(spawnSyncMock).toHaveBeenNthCalledWith(
      2,
      "uv",
      ["pip", "list", "--format", "json"],
      expect.objectContaining({
        cwd: "/repo/packages/py/shared",
      }),
    );
  });

  it("runs uv pip command without extra command args", async () => {
    const options: PipExecutorSchema = {
      command: "list",
    };

    const result = await executor(options, context);

    expect(result.success).toBe(true);
    expect(spawnSyncMock).toHaveBeenNthCalledWith(
      2,
      "uv",
      ["pip", "list"],
      expect.objectContaining({
        cwd: "/repo/packages/py/shared",
      }),
    );
  });
});
