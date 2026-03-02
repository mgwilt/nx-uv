import { readFileSync } from "node:fs";
import { dirname, join, posix } from "node:path";
import {
  createNodesFromFiles,
  CreateNodesResult,
  CreateNodesV2,
} from "@nx/devkit";
import { parse as parseToml } from "@iarna/toml";

export type InferredTargetName =
  | "sync"
  | "run"
  | "lock"
  | "test"
  | "lint"
  | "build"
  | "tree"
  | "export"
  | "format"
  | "venv"
  | "publish";

type InferredTargetOptions = {
  command?: string;
  commandArgs?: string[];
};

export type NxUvPluginOptions = {
  targetPrefix?: string;
  inferencePreset?: "minimal" | "standard" | "full";
  includeGlobalTargets?: boolean;
  inferredTargets?: Partial<
    Record<InferredTargetName, false | InferredTargetOptions>
  >;
};

export const createNodesV2: CreateNodesV2<NxUvPluginOptions> = [
  "**/pyproject.toml",
  (configFiles, options, context) =>
    createNodesFromFiles(
      (configFile) =>
        createProjectNode(configFile, context.workspaceRoot, options ?? {}),
      configFiles,
      options,
      context,
    ),
];

function createProjectNode(
  configFile: string,
  workspaceRoot: string,
  options: NxUvPluginOptions,
): CreateNodesResult {
  const projectRoot = normalizeRoot(dirname(configFile));
  const pyproject = readFileSync(join(workspaceRoot, configFile), "utf-8");
  const parsedPyproject = parseTomlDocument(pyproject);
  const projectName =
    parseProjectName(parsedPyproject) ??
    (projectRoot === "."
      ? "python-workspace"
      : sanitizeName(posix.basename(projectRoot)));

  return {
    projects: {
      [projectRoot]: {
        name: sanitizeName(projectName),
        root: projectRoot,
        targets: buildTargets(projectRoot, pyproject, parsedPyproject, options),
        metadata: {
          technology: "python",
          tool: "uv",
        },
      },
    },
  };
}

function buildTargets(
  projectRoot: string,
  pyproject: string,
  parsedPyproject: unknown | undefined,
  options: NxUvPluginOptions,
) {
  const targetPrefix = options.targetPrefix ?? "uv:";
  const preset = options.inferencePreset ?? "standard";
  const inferredTargets = options.inferredTargets ?? {};

  const baseTargets: Record<
    string,
    { executor: string; options: Record<string, unknown> }
  > = {};

  const defaults: Record<
    InferredTargetName,
    { command: string; commandArgs?: string[] }
  > = {
    sync: { command: "sync" },
    run: { command: "run", commandArgs: ["--", "python", "-V"] },
    lock: { command: "lock" },
    test: { command: "run", commandArgs: ["--", "pytest", "-q"] },
    lint: { command: "run", commandArgs: ["--", "ruff", "check", "."] },
    build: { command: "build" },
    tree: { command: "tree" },
    export: { command: "export" },
    format: { command: "format" },
    venv: { command: "venv" },
    publish: { command: "publish" },
  };

  const targetOrderByPreset: Record<
    "minimal" | "standard" | "full",
    InferredTargetName[]
  > = {
    minimal: ["sync", "run"],
    standard: ["sync", "run", "lock", "test", "lint", "build", "tree"],
    full: [
      "sync",
      "run",
      "lock",
      "test",
      "lint",
      "build",
      "tree",
      "export",
      "format",
      "venv",
      "publish",
    ],
  };

  for (const targetName of targetOrderByPreset[preset]) {
    const resolved = resolveInferredTarget(
      targetName,
      defaults[targetName],
      inferredTargets[targetName],
    );

    if (!resolved) {
      continue;
    }

    baseTargets[`${targetPrefix}${targetName}`] = target(
      projectRoot,
      resolved.command,
      resolved.commandArgs,
    );
  }

  const includeGlobalTargets = options.includeGlobalTargets ?? false;

  if (
    includeGlobalTargets &&
    projectRoot === "." &&
    hasUvWorkspaceTable(parsedPyproject, pyproject)
  ) {
    baseTargets[`${targetPrefix}python:list`] = {
      executor: "@mgwilt/nx-uv:python",
      options: {
        command: "list",
        cwd: projectRoot,
      },
    };
    baseTargets[`${targetPrefix}tool:list`] = {
      executor: "@mgwilt/nx-uv:tool",
      options: {
        command: "list",
        cwd: projectRoot,
      },
    };
    baseTargets[`${targetPrefix}cache:size`] = {
      executor: "@mgwilt/nx-uv:cache",
      options: {
        command: "size",
        cwd: projectRoot,
      },
    };
    baseTargets[`${targetPrefix}self:version`] = {
      executor: "@mgwilt/nx-uv:self",
      options: {
        command: "version",
        cwd: projectRoot,
      },
    };
  }

  return baseTargets;
}

function resolveInferredTarget(
  _targetName: InferredTargetName,
  defaults: { command: string; commandArgs?: string[] },
  configured: false | InferredTargetOptions | undefined,
): { command: string; commandArgs?: string[] } | null {
  if (configured === false) {
    return null;
  }

  if (!configured) {
    return defaults;
  }

  const hasArgsOverride = Object.prototype.hasOwnProperty.call(
    configured,
    "commandArgs",
  );

  const command = configured.command ?? defaults.command;
  const commandArgs = hasArgsOverride
    ? configured.commandArgs
    : defaults.commandArgs;

  return {
    command,
    ...(commandArgs?.length ? { commandArgs } : {}),
  };
}

function target(projectRoot: string, command: string, commandArgs?: string[]) {
  return {
    executor: "@mgwilt/nx-uv:project",
    options: {
      cwd: projectRoot,
      command,
      ...(commandArgs?.length ? { commandArgs } : {}),
    },
  };
}

function parseTomlDocument(content: string): unknown | undefined {
  try {
    return parseToml(content);
  } catch {
    return undefined;
  }
}

function parseProjectName(parsedToml: unknown | undefined): string | undefined {
  if (!isRecord(parsedToml)) {
    return undefined;
  }

  const project = parsedToml["project"];
  if (!isRecord(project)) {
    return undefined;
  }

  const name = project["name"];
  return typeof name === "string" ? name : undefined;
}

function hasUvWorkspaceTable(
  parsedToml: unknown | undefined,
  rawToml: string,
): boolean {
  if (isRecord(parsedToml)) {
    const tool = parsedToml["tool"];
    if (isRecord(tool)) {
      const uv = tool["uv"];
      if (isRecord(uv)) {
        const workspace = uv["workspace"];
        if (isRecord(workspace)) {
          return true;
        }
      }
    }
  }

  return rawToml.includes("[tool.uv.workspace]");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function sanitizeName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-_]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/--+/g, "-");
}

function normalizeRoot(root: string): string {
  if (!root || root === "") {
    return ".";
  }

  return root.replace(/\\/g, "/");
}
