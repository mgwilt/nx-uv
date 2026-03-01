import {
  addProjectConfiguration,
  formatFiles,
  generateFiles,
  joinPathFragments,
  names,
  Tree,
} from "@nx/devkit";
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

  if (current.includes("[tool.uv.workspace]")) {
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

export default projectGenerator;
