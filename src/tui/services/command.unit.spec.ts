import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import {
  findWorkspaceRoot,
  formatCommand,
  parseArgs,
  resolveNxInvocation,
  runCommand,
} from "./command";

const tempRoots: string[] = [];

function createTempDir(prefix: string): string {
  const root = mkdtempSync(join(tmpdir(), prefix));
  tempRoots.push(root);
  return root;
}

afterEach(() => {
  while (tempRoots.length > 0) {
    const root = tempRoots.pop();
    if (root) {
      rmSync(root, { recursive: true, force: true });
    }
  }
});

describe("tui command helpers", () => {
  it("finds workspace root by walking upward to nx.json", () => {
    const root = createTempDir("nx-uv-tui-root-");
    mkdirSync(join(root, "apps", "api"), { recursive: true });
    writeFileSync(join(root, "nx.json"), "{}\n", "utf-8");

    const found = findWorkspaceRoot(join(root, "apps", "api"));

    expect(found).toBe(root);
  });

  it("returns null when no workspace is found", () => {
    const root = createTempDir("nx-uv-tui-missing-");
    mkdirSync(join(root, "nested"), { recursive: true });

    const found = findWorkspaceRoot(join(root, "nested"));

    expect(found).toBeNull();
  });

  it("parses quoted and unquoted arg sequences", () => {
    const args = parseArgs(`run -- python -m "package tool" 'two words'`);

    expect(args).toEqual([
      "run",
      "--",
      "python",
      "-m",
      "package tool",
      "two words",
    ]);
  });

  it("prefers local nx binary when present", () => {
    const root = createTempDir("nx-uv-tui-local-nx-");
    mkdirSync(join(root, "node_modules", "nx", "bin"), { recursive: true });
    writeFileSync(
      join(root, "node_modules", "nx", "bin", "nx.js"),
      "// nx\n",
      "utf-8",
    );

    const invocation = resolveNxInvocation(root);

    expect(invocation.command).toBe(process.execPath);
    expect(invocation.args).toEqual([
      join(root, "node_modules", "nx", "bin", "nx.js"),
    ]);
  });

  it("falls back to npx nx when local binary is missing", () => {
    const root = createTempDir("nx-uv-tui-npx-");

    const invocation = resolveNxInvocation(root);

    expect(invocation).toEqual({
      command: "npx",
      args: ["nx"],
    });
  });

  it("runs commands and captures stdout/stderr", () => {
    const root = createTempDir("nx-uv-tui-run-");

    const result = runCommand({
      command: process.execPath,
      args: ["-e", "process.stdout.write('ok'); process.stderr.write('warn');"],
      cwd: root,
    });

    expect(result.ok).toBe(true);
    expect(result.status).toBe(0);
    expect(result.stdout).toBe("ok");
    expect(result.stderr).toBe("warn");
  });

  it("returns a failed result when command exits non-zero", () => {
    const root = createTempDir("nx-uv-tui-run-fail-");

    const result = runCommand({
      command: process.execPath,
      args: ["-e", "process.exit(2)"],
      cwd: root,
    });

    expect(result.ok).toBe(false);
    expect(result.status).toBe(2);
  });

  it("returns error details when command cannot start", () => {
    const root = createTempDir("nx-uv-tui-run-error-");

    const result = runCommand({
      command: "__definitely_missing_command__",
      args: [],
      cwd: root,
    });

    expect(result.ok).toBe(false);
    expect(result.error).toBeDefined();
  });

  it("formats commands with shell-safe quoting", () => {
    const formatted = formatCommand({
      command: "uv",
      args: ["run", "--", "python", "-m", "pkg tool", "it's"],
      cwd: "/tmp",
    });

    expect(formatted).toBe("uv run -- python -m 'pkg tool' 'it'\\''s'");
  });

  it("formats empty args and handles empty parse input", () => {
    const formatted = formatCommand({
      command: "uv",
      args: [""],
      cwd: "/tmp",
    });

    expect(formatted).toBe("uv ''");
    expect(parseArgs("")).toEqual([]);
  });
});
