import {
  chmodSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { ExecutorContext } from "@nx/devkit";
import { afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";

import executor from "../src/executors/project/project";

const tempRoots: string[] = [];

type ShimProbeResult = { ok: true } | { ok: false; reason: string };

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

function probeExecutableShimSupport(): ShimProbeResult {
  const probeRoot = mkdtempSync(join(tmpdir(), "nx-uv-e2e-probe-"));

  try {
    const probePath = join(probeRoot, "uv-probe");
    writeFileSync(
      probePath,
      "#!/usr/bin/env node\nprocess.exit(0);\n",
      "utf-8",
    );
    chmodSync(probePath, 0o755);

    const result = spawnSync(probePath, [], { stdio: "pipe" });

    if (result.error) {
      return { ok: false, reason: result.error.message };
    }

    if (result.status !== 0) {
      return {
        ok: false,
        reason: `probe exited with status ${result.status}`,
      };
    }

    return { ok: true };
  } finally {
    rmSync(probeRoot, { recursive: true, force: true });
  }
}

const shimProbe = probeExecutableShimSupport();
const e2eTest = shimProbe.ok ? it : it.skip;
const isCi = String(process.env.CI ?? "").toLowerCase() === "true";
const allowAllSkipped =
  String(process.env.NX_UV_ALLOW_E2E_ALL_SKIPPED ?? "").toLowerCase() === "1" ||
  String(process.env.NX_UV_ALLOW_E2E_ALL_SKIPPED ?? "").toLowerCase() ===
    "true";

describe("project executor e2e", () => {
  const originalPath = process.env.PATH ?? "";

  beforeAll(() => {
    if (!shimProbe.ok) {
      console.warn(
        `Skipping project executor e2e: executable shim probe failed (${shimProbe.reason}).`,
      );
    }
  });

  it("requires executable shim support in CI unless override is enabled", () => {
    if (shimProbe.ok) {
      return;
    }

    const message = [
      `Executable shim probe failed (${shimProbe.reason}).`,
      "E2E assertions were skipped.",
      "Set NX_UV_ALLOW_E2E_ALL_SKIPPED=1 to allow this outcome in known restricted CI environments.",
    ].join(" ");

    if (isCi && !allowAllSkipped) {
      throw new Error(message);
    }

    console.warn(message);
  });

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

  e2eTest(
    "executes uv using PATH and forwards command arguments and env vars",
    async () => {
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
    },
  );

  e2eTest("continues when uv version is outside tested range", async () => {
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
