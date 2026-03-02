import { existsSync, readFileSync } from "node:fs";
import * as path from "node:path";
import { CommandPlan, PatchPlan, PlannedAction } from "../types";
import { parseArgs, resolveNxInvocation } from "./command";

type Primitive = string | boolean | undefined;

type FormValues = Record<string, Primitive>;

export function planWorkspaceGenerator(
  workspaceRoot: string,
  values: FormValues,
): CommandPlan {
  return generatorPlan(workspaceRoot, {
    title: "Configure workspace",
    summary: "Run @mgwilt/nx-uv:workspace with the selected options.",
    generator: "@mgwilt/nx-uv:workspace",
    values,
  });
}

export function planProjectGenerator(
  workspaceRoot: string,
  values: FormValues,
): CommandPlan {
  const positional = String(values.name ?? "").trim();

  const flags: FormValues = {
    directory: values.directory,
    moduleName: values.moduleName,
    projectType: values.projectType,
    withTests: values.withTests,
    workspaceMember: values.workspaceMember,
    tags: values.tags,
  };

  return generatorPlan(workspaceRoot, {
    title: "Create Python project",
    summary: "Generate a Python app/lib/script project with nx-uv targets.",
    generator: "@mgwilt/nx-uv:project",
    values: flags,
    positional,
  });
}

export function planIntegrationGenerator(
  workspaceRoot: string,
  values: FormValues,
): CommandPlan {
  return generatorPlan(workspaceRoot, {
    title: "Apply integration template",
    summary:
      "Scaffold integration files for CI, Docker, notebooks, or dependency bots.",
    generator: "@mgwilt/nx-uv:integration",
    values,
  });
}

export function planConvertGenerator(
  workspaceRoot: string,
  values: FormValues,
): CommandPlan {
  return generatorPlan(workspaceRoot, {
    title: "Convert existing projects",
    summary: "Add nx-uv default targets to existing Python projects.",
    generator: "@mgwilt/nx-uv:convert",
    values,
  });
}

export function planRunTarget(
  workspaceRoot: string,
  values: FormValues,
): CommandPlan {
  const project = String(values.project ?? "").trim();
  const target = String(values.target ?? "").trim();
  const configuration = String(values.configuration ?? "").trim();
  const args = String(values.args ?? "").trim();

  const invocation = resolveNxInvocation(workspaceRoot);
  const runTarget = configuration
    ? `${project}:${target}:${configuration}`
    : `${project}:${target}`;

  const commandArgs = [...invocation.args, "run", runTarget];
  if (args) {
    commandArgs.push(...parseArgs(args));
  }

  return {
    kind: "command",
    title: "Run Nx target",
    summary: "Execute a target in the current monorepo.",
    mutatesRepo: false,
    apply: {
      command: invocation.command,
      args: commandArgs,
      cwd: workspaceRoot,
    },
  };
}

export function planRunUv(
  workspaceRoot: string,
  values: FormValues,
): CommandPlan {
  const args = parseArgs(String(values.args ?? "").trim());
  const cwdRaw = String(values.cwd ?? "").trim();

  return {
    kind: "command",
    title: "Run uv command",
    summary: "Execute an arbitrary uv command in the selected directory.",
    mutatesRepo: false,
    apply: {
      command: "uv",
      args,
      cwd: cwdRaw ? path.resolve(workspaceRoot, cwdRaw) : workspaceRoot,
    },
  };
}

export function planInferencePatch(
  workspaceRoot: string,
  values: FormValues,
): PatchPlan {
  const nxJsonPath = path.join(workspaceRoot, "nx.json");
  if (!existsSync(nxJsonPath)) {
    throw new Error("nx.json not found in workspace root.");
  }

  const before = readFileSync(nxJsonPath, "utf-8");
  const parsed = JSON.parse(before) as Record<string, unknown>;
  const plugins = Array.isArray(parsed.plugins) ? [...parsed.plugins] : [];

  const existingIndex = plugins.findIndex((entry) => {
    if (entry === "@mgwilt/nx-uv") {
      return true;
    }

    return (
      !!entry &&
      typeof entry === "object" &&
      (entry as Record<string, unknown>).plugin === "@mgwilt/nx-uv"
    );
  });

  const inferredTargetsRaw = String(values.inferredTargetsJson ?? "").trim();
  const inferredTargets = inferredTargetsRaw
    ? JSON.parse(inferredTargetsRaw)
    : undefined;

  const pluginEntry = {
    plugin: "@mgwilt/nx-uv",
    options: {
      targetPrefix: String(values.targetPrefix ?? "uv:"),
      inferencePreset: String(values.inferencePreset ?? "standard"),
      includeGlobalTargets: toBoolean(values.includeGlobalTargets),
      ...(inferredTargets ? { inferredTargets } : {}),
    },
  };

  if (existingIndex === -1) {
    plugins.push(pluginEntry);
  } else {
    const existing = plugins[existingIndex];
    if (existing === "@mgwilt/nx-uv") {
      plugins[existingIndex] = pluginEntry;
    } else {
      const existingObject = existing as Record<string, unknown>;
      const existingOptions =
        existingObject.options && typeof existingObject.options === "object"
          ? (existingObject.options as Record<string, unknown>)
          : {};

      plugins[existingIndex] = {
        ...existingObject,
        plugin: "@mgwilt/nx-uv",
        options: {
          ...existingOptions,
          ...pluginEntry.options,
        },
      };
    }
  }

  const afterJson = {
    ...parsed,
    plugins,
  };

  const after = `${JSON.stringify(afterJson, null, 2)}\n`;

  return {
    kind: "patch",
    title: "Configure inference options",
    summary: "Update nx.json plugin options for @mgwilt/nx-uv.",
    path: nxJsonPath,
    before,
    after,
    diff: createLineDiff(before, after),
  };
}

export function actionIsMutating(action: PlannedAction): boolean {
  if (action.kind === "patch") {
    return true;
  }

  return action.mutatesRepo;
}

function generatorPlan(
  workspaceRoot: string,
  input: {
    title: string;
    summary: string;
    generator: string;
    values: FormValues;
    positional?: string;
  },
): CommandPlan {
  const invocation = resolveNxInvocation(workspaceRoot);
  const flagArgs = buildFlagArgs(input.values);

  const applyArgs = [...invocation.args, "g", input.generator];
  if (input.positional) {
    applyArgs.push(input.positional);
  }

  applyArgs.push(...flagArgs);

  const previewArgs = [...applyArgs, "--dry-run", "--no-interactive"];

  return {
    kind: "command",
    title: input.title,
    summary: input.summary,
    mutatesRepo: true,
    apply: {
      command: invocation.command,
      args: applyArgs,
      cwd: workspaceRoot,
    },
    preview: {
      command: invocation.command,
      args: previewArgs,
      cwd: workspaceRoot,
    },
  };
}

function buildFlagArgs(values: FormValues): string[] {
  const args: string[] = [];

  for (const [key, rawValue] of Object.entries(values)) {
    if (rawValue === undefined) {
      continue;
    }

    if (typeof rawValue === "boolean") {
      args.push(`--${key}=${rawValue ? "true" : "false"}`);
      continue;
    }

    const value = String(rawValue).trim();
    if (!value) {
      continue;
    }

    args.push(`--${key}=${value}`);
  }

  return args;
}

function createLineDiff(before: string, after: string): string {
  const beforeLines = before.replace(/\r\n/g, "\n").split("\n");
  const afterLines = after.replace(/\r\n/g, "\n").split("\n");

  const max = Math.max(beforeLines.length, afterLines.length);
  const lines: string[] = ["--- before", "+++ after"];

  for (let index = 0; index < max; index += 1) {
    const left = beforeLines[index];
    const right = afterLines[index];

    if (left === right) {
      if (left !== undefined) {
        lines.push(` ${left}`);
      }
      continue;
    }

    if (left !== undefined) {
      lines.push(`-${left}`);
    }

    if (right !== undefined) {
      lines.push(`+${right}`);
    }
  }

  return lines.join("\n");
}

function toBoolean(value: Primitive): boolean {
  if (typeof value === "boolean") {
    return value;
  }

  return String(value).toLowerCase() === "true";
}
