import {
  addProjectConfiguration,
  formatFiles,
  generateFiles,
  joinPathFragments,
  logger,
  names,
  Tree,
} from "@nx/devkit";
import { parse as parseToml, stringify as stringifyToml } from "@iarna/toml";
import { minimatch } from "minimatch";
import * as path from "path";
import { defaultUvTargets, parseTags, toModuleName } from "../shared";
import { ProjectGeneratorSchema, PythonProjectType } from "./schema";

type NormalizedOptions = {
  name: string;
  projectName: string;
  packageName: string;
  moduleName: string;
  projectRoot: string;
  projectType: PythonProjectType;
  withTests: boolean;
  workspaceMember: boolean;
  tags: string[];
};

export async function projectGenerator(
  tree: Tree,
  options: ProjectGeneratorSchema,
) {
  const normalized = normalizeOptions(options);

  addProjectConfiguration(tree, normalized.projectName, {
    root: normalized.projectRoot,
    sourceRoot: `${normalized.projectRoot}/src`,
    projectType: normalized.projectType === "app" ? "application" : "library",
    tags: normalized.tags,
    targets: {
      ...defaultUvTargets(normalized.projectRoot),
      uv: {
        executor: "@mgwilt/nx-uv:uv",
        options: {
          cwd: normalized.projectRoot,
          args: ["help"],
        },
      },
    },
  });

  const templateRoot =
    normalized.projectType === "script" ? "files/script" : "files/package";

  generateFiles(
    tree,
    path.join(__dirname, templateRoot),
    normalized.projectRoot,
    {
      ...normalized,
      tmpl: "",
    },
  );

  if (normalized.projectType !== "app") {
    tree.delete(
      `${normalized.projectRoot}/src/${normalized.moduleName}/main.py`,
    );
  }

  if (!normalized.withTests || normalized.projectType === "script") {
    tree.delete(`${normalized.projectRoot}/tests/test_smoke.py`);
  }

  if (normalized.workspaceMember) {
    ensureWorkspaceMembership(tree, normalized.projectRoot);
  }

  if (!options.skipFormat) {
    await formatFiles(tree);
  }
}

function normalizeOptions(options: ProjectGeneratorSchema): NormalizedOptions {
  const trimmedName = options.name.trim();
  const nameSegments = trimmedName.split("/").filter(Boolean);

  let directory = options.directory?.trim();
  let projectName = trimmedName;

  if (nameSegments.length > 1) {
    projectName = nameSegments[nameSegments.length - 1];
    if (!directory) {
      directory = nameSegments.slice(0, -1).join("/");
    }
  }

  const normalizedName = names(projectName).fileName;
  const normalizedDirectory = directory
    ? directory.replace(/\\/g, "/").replace(/^\/+|\/+$/g, "")
    : "packages/py";

  const projectRoot = joinPathFragments(normalizedDirectory, normalizedName);
  const moduleName = options.moduleName
    ? toModuleName(options.moduleName)
    : toModuleName(normalizedName);

  return {
    name: normalizedName,
    projectName: normalizedName,
    packageName: normalizedName.replace(/_/g, "-"),
    moduleName,
    projectRoot,
    projectType: options.projectType ?? "lib",
    withTests: options.withTests ?? true,
    workspaceMember: options.workspaceMember ?? true,
    tags: parseTags(options.tags),
  };
}

function ensureWorkspaceMembership(tree: Tree, projectRoot: string): void {
  const rootPyprojectPath = "pyproject.toml";

  if (!tree.exists(rootPyprojectPath)) {
    return;
  }

  const current = tree.read(rootPyprojectPath, "utf-8") ?? "";
  const parsed = parseTomlDocument(current);

  if (isRecord(parsed)) {
    const workspaceTable = readWorkspaceTable(parsed);

    if (workspaceTable) {
      const members = toStringArray(workspaceTable["members"]);
      const exclude = toStringArray(workspaceTable["exclude"]);

      const isIncluded = members.some((pattern) =>
        matchesWorkspacePattern(projectRoot, pattern),
      );
      const blockingExclude = exclude.some((pattern) =>
        matchesWorkspacePattern(projectRoot, pattern),
      );

      let changed = false;

      if ((!isIncluded || blockingExclude) && !members.includes(projectRoot)) {
        members.push(projectRoot);
        changed = true;
      }

      const filteredExclude = exclude.filter(
        (pattern) => !matchesWorkspacePattern(projectRoot, pattern),
      );

      if (filteredExclude.length !== exclude.length) {
        changed = true;
      }

      if (!changed) {
        return;
      }

      workspaceTable["members"] = members;

      if (filteredExclude.length > 0) {
        workspaceTable["exclude"] = filteredExclude;
      } else {
        delete workspaceTable["exclude"];
      }

      tree.write(
        rootPyprojectPath,
        `${stringifyToml(parsed as Parameters<typeof stringifyToml>[0]).trimEnd()}\n`,
      );
      return;
    }
  } else if (current.includes("[tool.uv.workspace]")) {
    logger.warn(
      `Unable to parse ${rootPyprojectPath}. Skipping workspace membership update for ${projectRoot}.`,
    );
    return;
  }

  const workspaceTable = [
    "",
    "[tool.uv.workspace]",
    `members = ["${projectRoot}"]`,
    "",
  ].join("\n");

  tree.write(rootPyprojectPath, `${current.trimEnd()}${workspaceTable}`);
}

function parseTomlDocument(content: string): unknown | undefined {
  try {
    return parseToml(content);
  } catch {
    return undefined;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function readWorkspaceTable(
  parsedToml: Record<string, unknown>,
): Record<string, unknown> | undefined {
  const tool = parsedToml["tool"];
  if (!isRecord(tool)) {
    return undefined;
  }

  const uv = tool["uv"];
  if (!isRecord(uv)) {
    return undefined;
  }

  const workspace = uv["workspace"];
  return isRecord(workspace) ? workspace : undefined;
}

function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((entry): entry is string => typeof entry === "string");
}

function matchesWorkspacePattern(
  projectRoot: string,
  pattern: string,
): boolean {
  const normalizedPattern = pattern.replace(/\\/g, "/").trim();
  return (
    normalizedPattern === projectRoot ||
    minimatch(projectRoot, normalizedPattern, {
      dot: true,
    })
  );
}

export default projectGenerator;
