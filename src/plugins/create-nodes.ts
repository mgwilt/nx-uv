import { readFileSync } from "node:fs";
import { dirname, join, posix } from "node:path";
import { createNodesFromFiles } from "nx/src/project-graph/plugins";
import {
  CreateNodesResult,
  CreateNodesV2,
} from "nx/src/project-graph/plugins/public-api";

export type NxUvPluginOptions = {
  targetPrefix?: string;
  inferencePreset?: "minimal" | "standard" | "full";
  includeGlobalTargets?: boolean;
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
  const projectName =
    parseProjectName(pyproject) ??
    (projectRoot === "."
      ? "python-workspace"
      : sanitizeName(posix.basename(projectRoot)));

  return {
    projects: {
      [projectRoot]: {
        name: sanitizeName(projectName),
        root: projectRoot,
        targets: buildTargets(projectRoot, pyproject, options),
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
  options: NxUvPluginOptions,
) {
  const targetPrefix = options.targetPrefix ?? "uv:";
  const preset = options.inferencePreset ?? "standard";

  const baseTargets: Record<
    string,
    { executor: string; options: Record<string, unknown> }
  > = {
    [`${targetPrefix}sync`]: target(projectRoot, "sync"),
    [`${targetPrefix}run`]: target(projectRoot, "run", ["--", "python", "-V"]),
  };

  if (preset === "standard" || preset === "full") {
    baseTargets[`${targetPrefix}lock`] = target(projectRoot, "lock");
    baseTargets[`${targetPrefix}test`] = target(projectRoot, "run", [
      "--",
      "pytest",
      "-q",
    ]);
    baseTargets[`${targetPrefix}lint`] = target(projectRoot, "run", [
      "--",
      "ruff",
      "check",
      ".",
    ]);
    baseTargets[`${targetPrefix}build`] = target(projectRoot, "build");
    baseTargets[`${targetPrefix}tree`] = target(projectRoot, "tree");
  }

  if (preset === "full") {
    baseTargets[`${targetPrefix}export`] = target(projectRoot, "export");
    baseTargets[`${targetPrefix}format`] = target(projectRoot, "format");
    baseTargets[`${targetPrefix}venv`] = target(projectRoot, "venv");
    baseTargets[`${targetPrefix}publish`] = target(projectRoot, "publish");
  }

  const includeGlobalTargets = options.includeGlobalTargets ?? false;

  if (
    includeGlobalTargets &&
    projectRoot === "." &&
    pyproject.includes("[tool.uv.workspace]")
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

function parseProjectName(content: string): string | undefined {
  const sectionMatch = /\[project\][\s\S]*?(\n\[[^\]]+\]|$)/m.exec(content);
  if (!sectionMatch) {
    return undefined;
  }

  const nameMatch = /^\s*name\s*=\s*['"]([^'"]+)['"]/m.exec(sectionMatch[0]);
  return nameMatch?.[1];
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
