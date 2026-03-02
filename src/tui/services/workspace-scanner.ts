import { existsSync, readFileSync } from "node:fs";
import * as path from "node:path";
import {
  NxUvPluginOptions,
  ProjectSnapshot,
  WorkspaceSnapshot,
} from "../types";
import { findWorkspaceRoot, resolveNxInvocation, runCommand } from "./command";

export function discoverWorkspace(cwd: string): WorkspaceSnapshot | null {
  const workspaceRoot = findWorkspaceRoot(cwd);
  if (!workspaceRoot) {
    return null;
  }

  const nxJsonPath = path.join(workspaceRoot, "nx.json");
  const nxJson = safeParseJson(readFileSync(nxJsonPath, "utf-8"));

  const pluginOptions = extractPluginOptions(nxJson);
  const projects = listProjects(workspaceRoot, nxJson);
  const rootPyprojectPath = path.join(workspaceRoot, "pyproject.toml");

  const rootPyproject = existsSync(rootPyprojectPath)
    ? readFileSync(rootPyprojectPath, "utf-8")
    : "";

  return {
    workspaceRoot,
    hasRootPyproject: existsSync(rootPyprojectPath),
    hasUvWorkspaceTable:
      rootPyproject.includes("[tool.uv.workspace]") ||
      rootPyproject.includes("workspace = {"),
    uvVersion: detectUvVersion(workspaceRoot),
    pluginConfigured: !!pluginOptions,
    pluginOptions: pluginOptions ?? {},
    projects,
  };
}

function listProjects(
  workspaceRoot: string,
  nxJson: unknown,
): ProjectSnapshot[] {
  const invocation = resolveNxInvocation(workspaceRoot);
  const projectListResult = runCommand({
    command: invocation.command,
    args: [...invocation.args, "show", "projects", "--json"],
    cwd: workspaceRoot,
  });

  const projectNames = parseProjectNames(projectListResult.stdout, nxJson);

  const projects: ProjectSnapshot[] = [];
  for (const projectName of projectNames) {
    const details = readProjectDetails(workspaceRoot, projectName);
    if (details) {
      projects.push(details);
    }
  }

  return projects.sort((a, b) => a.name.localeCompare(b.name));
}

function parseProjectNames(output: string, nxJson: unknown): string[] {
  const parsed = safeParseJson(output);
  if (
    Array.isArray(parsed) &&
    parsed.every((entry) => typeof entry === "string")
  ) {
    return parsed;
  }

  if (parsed && typeof parsed === "object") {
    return Object.keys(parsed as Record<string, unknown>);
  }

  if (nxJson && typeof nxJson === "object") {
    const projects = (nxJson as Record<string, unknown>)["projects"];
    if (projects && typeof projects === "object") {
      return Object.keys(projects as Record<string, unknown>);
    }
  }

  return [];
}

function readProjectDetails(
  workspaceRoot: string,
  projectName: string,
): ProjectSnapshot | null {
  const invocation = resolveNxInvocation(workspaceRoot);
  const detailsResult = runCommand({
    command: invocation.command,
    args: [...invocation.args, "show", "project", projectName, "--json"],
    cwd: workspaceRoot,
  });

  if (!detailsResult.ok) {
    return null;
  }

  const parsed = safeParseJson(detailsResult.stdout);
  if (!parsed || typeof parsed !== "object") {
    return null;
  }

  const project = parsed as Record<string, unknown>;
  const root =
    typeof project["root"] === "string" ? project["root"] : projectName;
  const projectType =
    typeof project["projectType"] === "string"
      ? project["projectType"]
      : "unknown";
  const tags = Array.isArray(project["tags"])
    ? project["tags"].filter((tag): tag is string => typeof tag === "string")
    : [];

  const targetsRecord =
    project["targets"] && typeof project["targets"] === "object"
      ? (project["targets"] as Record<string, unknown>)
      : {};

  return {
    name: projectName,
    root,
    projectType,
    tags,
    targets: Object.keys(targetsRecord).sort(),
    hasPyproject: existsSync(path.join(workspaceRoot, root, "pyproject.toml")),
  };
}

function detectUvVersion(workspaceRoot: string): string | null {
  const uvVersionResult = runCommand({
    command: "uv",
    args: ["--version"],
    cwd: workspaceRoot,
  });

  if (!uvVersionResult.ok) {
    return null;
  }

  const match = /^uv\s+([^\s]+)$/.exec(uvVersionResult.stdout.trim());
  const fallback = uvVersionResult.stdout.trim();
  return match?.[1] ?? (fallback.length > 0 ? fallback : null);
}

function extractPluginOptions(nxJson: unknown): NxUvPluginOptions | null {
  if (!nxJson || typeof nxJson !== "object") {
    return null;
  }

  const plugins = (nxJson as Record<string, unknown>)["plugins"];
  if (!Array.isArray(plugins)) {
    return null;
  }

  for (const entry of plugins) {
    if (entry === "@mgwilt/nx-uv") {
      return {
        targetPrefix: "uv:",
        inferencePreset: "standard",
        includeGlobalTargets: false,
      };
    }

    if (
      entry &&
      typeof entry === "object" &&
      (entry as Record<string, unknown>)["plugin"] === "@mgwilt/nx-uv"
    ) {
      const options = (entry as Record<string, unknown>)["options"];
      if (options && typeof options === "object") {
        return options as NxUvPluginOptions;
      }

      return {
        targetPrefix: "uv:",
        inferencePreset: "standard",
        includeGlobalTargets: false,
      };
    }
  }

  return null;
}

function safeParseJson(content: string): unknown {
  try {
    return JSON.parse(content);
  } catch {
    return null;
  }
}
