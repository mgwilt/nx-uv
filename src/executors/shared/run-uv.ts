import { ExecutorContext, logger } from "@nx/devkit";
import * as childProcess from "child_process";
import * as path from "path";
import { UvBaseExecutorSchema } from "./options";

const SUPPORTED_UV_VERSION = /^0\.9\./;

type UvCommandResult = { success: boolean };

type VersionCheckResult = { ok: true } | { ok: false; message: string };

export function resolveWorkingDirectory(
  options: UvBaseExecutorSchema,
  context: ExecutorContext,
): string {
  if (options.cwd) {
    return resolvePath(context.root, options.cwd);
  }

  const projectName = context.projectName;
  const projectRoot =
    projectName &&
    context.projectsConfigurations?.projects?.[projectName]?.root;

  if (projectRoot) {
    return resolvePath(context.root, projectRoot);
  }

  return context.root;
}

export function runUvCommand(
  commandArgs: string[],
  options: UvBaseExecutorSchema,
  context: ExecutorContext,
): UvCommandResult {
  const cwd = resolveWorkingDirectory(options, context);

  if (!options.skipVersionCheck) {
    const versionCheck = assertUvVersion(cwd);
    if (!versionCheck.ok) {
      logger.error(versionCheck.message);
      return { success: false };
    }
  }

  const uvArgs = [
    ...buildGlobalArgs(options, context.root),
    ...commandArgs,
    ...(options.extraArgs ?? []),
  ];

  logger.info(`Running: uv ${uvArgs.join(" ")}`);
  logger.info(`Working directory: ${cwd}`);

  const result = childProcess.spawnSync("uv", uvArgs, {
    cwd,
    env: {
      ...process.env,
      ...normalizeEnv(options.env),
    },
    stdio: "inherit",
  });

  if (result.error) {
    logger.error(result.error.message);
    return { success: false };
  }

  return { success: result.status === 0 };
}

function buildGlobalArgs(
  options: UvBaseExecutorSchema,
  workspaceRoot: string,
): string[] {
  const args: string[] = [];

  if (options.directory) {
    args.push("--directory", resolvePath(workspaceRoot, options.directory));
  }

  if (options.project) {
    args.push("--project", resolvePath(workspaceRoot, options.project));
  }

  if (options.configFile) {
    args.push("--config-file", resolvePath(workspaceRoot, options.configFile));
  }

  if (options.noConfig) {
    args.push("--no-config");
  }

  if (options.offline) {
    args.push("--offline");
  }

  if (options.noProgress) {
    args.push("--no-progress");
  }

  if (options.quiet) {
    args.push("--quiet");
  }

  if (options.verbose) {
    args.push("--verbose");
  }

  if (options.color) {
    args.push("--color", options.color);
  }

  if (options.nativeTls) {
    args.push("--native-tls");
  }

  if (options.cacheDir) {
    args.push("--cache-dir", resolvePath(workspaceRoot, options.cacheDir));
  }

  if (options.noCache) {
    args.push("--no-cache");
  }

  if (options.managedPython) {
    args.push("--managed-python");
  }

  if (options.noManagedPython) {
    args.push("--no-managed-python");
  }

  if (options.noPythonDownloads) {
    args.push("--no-python-downloads");
  }

  if (options.allowInsecureHost?.length) {
    for (const host of options.allowInsecureHost) {
      args.push("--allow-insecure-host", host);
    }
  }

  return args;
}

function normalizeEnv(
  env: Record<string, string> | undefined,
): Record<string, string> | undefined {
  if (!env) {
    return undefined;
  }

  return Object.fromEntries(
    Object.entries(env).map(([key, value]) => [key, String(value)]),
  );
}

function assertUvVersion(cwd: string): VersionCheckResult {
  const result = childProcess.spawnSync("uv", ["--version"], {
    cwd,
    env: process.env,
    stdio: "pipe",
    encoding: "utf-8",
  });

  if (result.error) {
    return {
      ok: false,
      message: `Failed to execute uv for version check: ${result.error.message}`,
    };
  }

  if (result.status !== 0) {
    return {
      ok: false,
      message:
        "Unable to determine uv version. Ensure uv is installed and on PATH.",
    };
  }

  const version = parseUvVersion(result.stdout?.toString() ?? "");

  if (!version) {
    return {
      ok: false,
      message: 'Unable to parse uv version output. Expected: "uv 0.9.x".',
    };
  }

  if (!SUPPORTED_UV_VERSION.test(version)) {
    return {
      ok: false,
      message: `Unsupported uv version ${version}. This plugin targets uv 0.9.x.`,
    };
  }

  return { ok: true };
}

function parseUvVersion(output: string): string | null {
  const trimmed = output.trim();
  const match = /^uv\s+([0-9]+\.[0-9]+\.[0-9]+(?:[-+].*)?)$/m.exec(trimmed);
  return match?.[1] ?? null;
}

function resolvePath(workspaceRoot: string, targetPath: string): string {
  if (path.isAbsolute(targetPath)) {
    return targetPath;
  }

  return path.resolve(workspaceRoot, targetPath);
}
