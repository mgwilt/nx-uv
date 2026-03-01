import { ExecutorContext } from "@nx/devkit";
import { beforeEach, describe, expect, it, vi } from "vitest";

const spawnSyncMock = vi.hoisted(() => vi.fn());

vi.mock("child_process", () => ({
  spawnSync: spawnSyncMock,
}));

import executor from "./sync";
import { SyncExecutorSchema } from "./schema";

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

describe("sync executor", () => {
  beforeEach(() => {
    spawnSyncMock.mockReset();
    mockUvSuccess();
  });

  it("runs uv sync with flags", async () => {
    const options: SyncExecutorSchema = {
      package: "shared",
      frozen: true,
      extraArgs: ["--check"],
    };

    const result = await executor(options, context);

    expect(result.success).toBe(true);
    expect(spawnSyncMock).toHaveBeenNthCalledWith(
      2,
      "uv",
      ["sync", "--package", "shared", "--frozen", "--check"],
      expect.objectContaining({
        cwd: "/repo/packages/py/shared",
      }),
    );
  });

  it("runs uv sync without optional flags", async () => {
    const options: SyncExecutorSchema = {};

    const result = await executor(options, context);

    expect(result.success).toBe(true);
    expect(spawnSyncMock).toHaveBeenNthCalledWith(
      2,
      "uv",
      ["sync"],
      expect.objectContaining({
        cwd: "/repo/packages/py/shared",
      }),
    );
  });
});
