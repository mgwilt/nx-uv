import { writeFileSync } from "node:fs";
import {
  ActionPreview,
  ApplyResult,
  CommandPlan,
  FileChange,
  PatchPlan,
  PlannedAction,
} from "../types";
import { formatCommand, runCommand } from "./command";

export function buildPreview(action: PlannedAction): ActionPreview {
  if (action.kind === "patch") {
    return {
      summary: action.summary,
      commands: [`update ${action.path}`],
      fileChanges: [
        {
          operation: "UPDATE",
          path: action.path,
        },
      ],
      stdout: action.diff,
      stderr: "",
    };
  }

  return buildCommandPreview(action);
}

function buildCommandPreview(plan: CommandPlan): ActionPreview {
  const previewCommand = plan.preview ?? plan.apply;
  const result = runCommand(previewCommand);

  return {
    summary: plan.summary,
    commands: [formatCommand(previewCommand)],
    fileChanges: extractFileChanges(result.stdout, result.stderr),
    stdout: result.stdout,
    stderr: result.stderr,
  };
}

export function applyAction(action: PlannedAction): ApplyResult {
  if (action.kind === "patch") {
    return applyPatch(action);
  }

  const result = runCommand(action.apply);

  return {
    success: result.ok,
    summary: action.summary,
    stdout: result.stdout,
    stderr: result.error
      ? `${result.stderr}\n${result.error}`.trim()
      : result.stderr,
  };
}

function applyPatch(patch: PatchPlan): ApplyResult {
  writeFileSync(patch.path, patch.after, "utf-8");
  return {
    success: true,
    summary: patch.summary,
    stdout: `Updated ${patch.path}`,
    stderr: "",
  };
}

function extractFileChanges(stdout: string, stderr: string): FileChange[] {
  const combined = `${stdout}\n${stderr}`;
  const lines = combined.replace(/\r\n/g, "\n").split("\n");
  const changes: FileChange[] = [];

  for (const line of lines) {
    const match = /^\s*(CREATE|UPDATE|DELETE)\s+(.+)$/.exec(line.trim());
    if (!match) {
      continue;
    }

    const operation = match[1] as FileChange["operation"];
    const path = match[2].trim();

    if (
      !changes.some(
        (entry) => entry.operation === operation && entry.path === path,
      )
    ) {
      changes.push({ operation, path });
    }
  }

  return changes;
}
