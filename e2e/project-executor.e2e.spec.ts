import {
  chmodSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { ExecutorContext } from "@nx/devkit";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import executor from "../src/executors/project/project";

const tempRoots: string[] = [];

function createContext(workspaceRoot: string): ExecutorContext {
  return {
    root: workspaceRoot,
    cwd: workspaceRoot,
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
}

function writeFakeUvBinary(binPath: string): void {
  const script = `#!/usr/bin/env node
const fs = require('node:fs');

const args = process.argv.slice(2);

if (args[0] === '--version') {
  process.stdout.write(process.env.UV_FAKE_VERSION || 'uv 0.9.99\\n');
  process.exit(0);
}

const logFile = process.env.UV_FAKE_LOG_FILE;
if (!logFile) {
  process.stderr.write('UV_FAKE_LOG_FILE is required\\n');
  process.exit(2);
}

fs.writeFileSync(
  logFile,
  JSON.stringify({ cwd: process.cwd(), args, testFlag: process.env.TEST_FLAG || null }),
  'utf-8',
);
process.exit(0);
`;

  writeFileSync(binPath, script, "utf-8");
  chmodSync(binPath, 0o755);
}

describe("project executor e2e", () => {
  const originalPath = process.env.PATH ?? "";

  beforeEach(() => {
    delete process.env.UV_FAKE_VERSION;
    delete process.env.UV_FAKE_LOG_FILE;
    delete process.env.TEST_FLAG;
  });

  afterEach(() => {
    process.env.PATH = originalPath;

    while (tempRoots.length > 0) {
      const root = tempRoots.pop();
      if (root) {
        rmSync(root, { recursive: true, force: true });
      }
    }
  });

  it("executes uv using PATH and forwards command arguments and env vars", async () => {
    const workspaceRoot = mkdtempSync(join(tmpdir(), "nx-uv-e2e-"));
    tempRoots.push(workspaceRoot);

    const packageRoot = join(workspaceRoot, "packages/py/shared");
    const binRoot = join(workspaceRoot, "bin");
    mkdirSync(packageRoot, { recursive: true });
    mkdirSync(binRoot, { recursive: true });

    const uvPath = join(binRoot, "uv");
    writeFakeUvBinary(uvPath);

    const logFile = join(workspaceRoot, "uv-command-log.json");

    process.env.PATH = `${binRoot}:${originalPath}`;
    process.env.UV_FAKE_LOG_FILE = logFile;

    const result = await executor(
      {
        command: "run",
        commandArgs: ["--", "python", "-V"],
        env: {
          TEST_FLAG: "enabled",
        },
      },
      createContext(workspaceRoot),
    );

    const logged = JSON.parse(readFileSync(logFile, "utf-8")) as {
      cwd: string;
      args: string[];
      testFlag: string | null;
    };

    expect(result.success).toBe(true);
    expect(logged.cwd).toBe(packageRoot);
    expect(logged.args).toEqual(["run", "--", "python", "-V"]);
    expect(logged.testFlag).toBe("enabled");
  });

  it("continues when uv version is outside tested range", async () => {
    const workspaceRoot = mkdtempSync(join(tmpdir(), "nx-uv-e2e-"));
    tempRoots.push(workspaceRoot);

    const packageRoot = join(workspaceRoot, "packages/py/shared");
    const binRoot = join(workspaceRoot, "bin");
    mkdirSync(packageRoot, { recursive: true });
    mkdirSync(binRoot, { recursive: true });

    const uvPath = join(binRoot, "uv");
    writeFakeUvBinary(uvPath);

    const logFile = join(workspaceRoot, "uv-command-log.json");

    process.env.PATH = `${binRoot}:${originalPath}`;
    process.env.UV_FAKE_LOG_FILE = logFile;
    process.env.UV_FAKE_VERSION = "uv 1.0.0\n";

    const result = await executor(
      {
        command: "sync",
      },
      createContext(workspaceRoot),
    );

    const logged = JSON.parse(readFileSync(logFile, "utf-8")) as {
      cwd: string;
      args: string[];
    };

    expect(result.success).toBe(true);
    expect(logged.cwd).toBe(packageRoot);
    expect(logged.args).toEqual(["sync"]);
  });
});
