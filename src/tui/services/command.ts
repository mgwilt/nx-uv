import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import * as path from "node:path";
import { CommandResult, CommandSpec } from "../types";

export function findWorkspaceRoot(start: string): string | null {
  let current = path.resolve(start);

  while (true) {
    if (existsSync(path.join(current, "nx.json"))) {
      return current;
    }

    const parent = path.dirname(current);
    if (parent === current) {
      return null;
    }

    current = parent;
  }
}

export function resolveNxInvocation(workspaceRoot: string): {
  command: string;
  args: string[];
} {
  const localNxBin = path.join(
    workspaceRoot,
    "node_modules",
    "nx",
    "bin",
    "nx.js",
  );
  if (existsSync(localNxBin)) {
    return {
      command: process.execPath,
      args: [localNxBin],
    };
  }

  return {
    command: "npx",
    args: ["nx"],
  };
}

export function runCommand(spec: CommandSpec): CommandResult {
  const result = spawnSync(spec.command, spec.args, {
    cwd: spec.cwd,
    encoding: "utf-8",
    stdio: "pipe",
    env: {
      ...process.env,
      ...(spec.env ?? {}),
    },
  });

  return {
    command: spec,
    ok: !result.error && result.status === 0,
    status: result.status,
    stdout: result.stdout?.toString() ?? "",
    stderr: result.stderr?.toString() ?? "",
    error: result.error?.message,
  };
}

export function formatCommand(spec: CommandSpec): string {
  const escaped = spec.args.map(quoteArg).join(" ");
  return `${spec.command} ${escaped}`.trim();
}

function quoteArg(value: string): string {
  if (value.length === 0) {
    return "''";
  }

  if (/[^A-Za-z0-9_./:=@-]/.test(value)) {
    const escaped = value.replace(/'/g, "'\\''");
    return `'${escaped}'`;
  }

  return value;
}

export function parseArgs(raw: string): string[] {
  const parts = raw.match(/(?:[^\s"']+|"[^"]*"|'[^']*')+/g) ?? [];
  return parts
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      if (
        (part.startsWith('"') && part.endsWith('"')) ||
        (part.startsWith("'") && part.endsWith("'"))
      ) {
        return part.slice(1, -1);
      }

      return part;
    });
}
