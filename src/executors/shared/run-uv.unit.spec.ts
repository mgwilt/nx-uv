import { ExecutorContext } from "@nx/devkit";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { UvBaseExecutorSchema } from "./options";

const spawnSyncMock = vi.hoisted(() => vi.fn());

vi.mock("child_process", () => ({
  spawnSync: spawnSyncMock,
}));

import { resolveWorkingDirectory, runUvCommand } from "./run-uv";

const baseContext: ExecutorContext = {
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

function uvVersionResult(version: string) {
  return {
    status: 0,
    stdout: `uv ${version}\n`,
    stderr: "",
    pid: 1,
    output: [],
    signal: null,
  };
}

function uvCommandResult(status = 0) {
  return {
    status,
    stdout: "",
    stderr: "",
    pid: 1,
    output: [],
    signal: null,
  };
}

describe("resolveWorkingDirectory", () => {
  it("returns absolute cwd without rebasing it to workspace root", () => {
    expect(resolveWorkingDirectory({ cwd: "/tmp/uv" }, baseContext)).toBe(
      "/tmp/uv",
    );
  });

  it("prefers explicit cwd over project root", () => {
    expect(resolveWorkingDirectory({ cwd: "custom" }, baseContext)).toBe(
      "/repo/custom",
    );
  });

  it("uses project root when cwd is not provided", () => {
    expect(resolveWorkingDirectory({}, baseContext)).toBe(
      "/repo/packages/py/shared",
    );
  });

  it("falls back to workspace root for unknown projects", () => {
    const context = {
      ...baseContext,
      projectName: "missing",
    };

    expect(resolveWorkingDirectory({}, context)).toBe("/repo");
  });
});

describe("runUvCommand", () => {
  beforeEach(() => {
    spawnSyncMock.mockReset();
  });

  it("warns and continues when uv version is outside tested range", () => {
    spawnSyncMock.mockImplementation((_command: string, args: string[]) => {
      if (args[0] === "--version") {
        return uvVersionResult("1.0.0");
      }

      return uvCommandResult();
    });

    const result = runUvCommand(["sync"], {}, baseContext);

    expect(result.success).toBe(true);
    expect(spawnSyncMock).toHaveBeenCalledTimes(2);
  });

  it("warns and continues when uv version output cannot be parsed", () => {
    spawnSyncMock.mockImplementation((_command: string, args: string[]) => {
      if (args[0] === "--version") {
        return {
          ...uvVersionResult("0.9.29"),
          stdout: "unknown output\n",
        };
      }

      return uvCommandResult();
    });

    const result = runUvCommand(["sync"], {}, baseContext);

    expect(result.success).toBe(true);
    expect(spawnSyncMock).toHaveBeenCalledTimes(2);
  });

  it("fails when version check command exits non-zero", () => {
    spawnSyncMock.mockReturnValue({
      status: 2,
      stdout: "",
      stderr: "uv not found",
      pid: 1,
      output: [],
      signal: null,
    });

    const result = runUvCommand(["sync"], {}, baseContext);

    expect(result.success).toBe(false);
  });

  it("fails when version check command cannot execute", () => {
    spawnSyncMock.mockReturnValue({
      status: 1,
      stdout: "",
      stderr: "",
      error: new Error("ENOENT"),
      pid: 1,
      output: [],
      signal: null,
    });

    const result = runUvCommand(["sync"], {}, baseContext);

    expect(result.success).toBe(false);
  });

  it("builds global args and runs the command when skipping version checks", () => {
    spawnSyncMock.mockReturnValue(uvCommandResult());

    const options: UvBaseExecutorSchema = {
      skipVersionCheck: true,
      cwd: "packages/py/shared",
      directory: "packages/py/shared",
      project: "packages/py/shared",
      configFile: "pyproject.toml",
      noConfig: true,
      offline: true,
      noProgress: true,
      quiet: true,
      verbose: true,
      color: "always",
      nativeTls: true,
      cacheDir: ".cache/uv",
      noCache: true,
      managedPython: true,
      noManagedPython: true,
      noPythonDownloads: true,
      allowInsecureHost: ["localhost", "example.com"],
      env: {
        TEST_FLAG: "1",
        NUMERIC: "42",
      },
      extraArgs: ["--frozen"],
    };

    const result = runUvCommand(["sync"], options, baseContext);

    expect(result.success).toBe(true);
    expect(spawnSyncMock).toHaveBeenCalledWith(
      "uv",
      [
        "--directory",
        "/repo/packages/py/shared",
        "--project",
        "/repo/packages/py/shared",
        "--config-file",
        "/repo/pyproject.toml",
        "--no-config",
        "--offline",
        "--no-progress",
        "--quiet",
        "--verbose",
        "--color",
        "always",
        "--native-tls",
        "--cache-dir",
        "/repo/.cache/uv",
        "--no-cache",
        "--managed-python",
        "--no-managed-python",
        "--no-python-downloads",
        "--allow-insecure-host",
        "localhost",
        "--allow-insecure-host",
        "example.com",
        "sync",
        "--frozen",
      ],
      expect.objectContaining({
        cwd: "/repo/packages/py/shared",
        stdio: "inherit",
        env: expect.objectContaining({
          TEST_FLAG: "1",
          NUMERIC: "42",
        }),
      }),
    );
  });

  it("returns false when command execution errors", () => {
    spawnSyncMock.mockImplementation((_command: string, args: string[]) => {
      if (args[0] === "--version") {
        return uvVersionResult("0.9.29");
      }

      return {
        status: 1,
        error: new Error("boom"),
      };
    });

    const result = runUvCommand(["sync"], {}, baseContext);

    expect(result.success).toBe(false);
  });

  it("returns false when uv command exits non-zero", () => {
    spawnSyncMock.mockImplementation((_command: string, args: string[]) => {
      if (args[0] === "--version") {
        return uvVersionResult("0.9.29");
      }

      return uvCommandResult(2);
    });

    const result = runUvCommand(["sync"], {}, baseContext);

    expect(result.success).toBe(false);
  });
});
