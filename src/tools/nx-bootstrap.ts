import { spawnSync } from "node:child_process";

export interface NxBootstrapStep {
  label: string;
  args: string[];
}

export interface NxBootstrapCommandResult {
  status: number;
  stdout: string;
  stderr: string;
  error: string | null;
}

export interface NxBootstrapCheckResult {
  ok: boolean;
  bootstrapFailure: boolean;
  command: string | null;
}

type SpawnRunner = (
  command: string,
  args: string[],
  options: { encoding: "utf-8"; env: NodeJS.ProcessEnv },
) => {
  status: number | null;
  stdout?: string;
  stderr?: string;
  error?: { message?: string };
};

export const DEFAULT_STEPS: NxBootstrapStep[] = [
  {
    label: "nx report",
    args: ["nx", "report"],
  },
  {
    label: "nx show projects",
    args: ["nx", "show", "projects", "--json"],
  },
];

export const BOOTSTRAP_PATTERNS: RegExp[] = [
  /Failed to load \d+ default Nx plugin\(s\)/i,
  /Failed to start plugin worker/i,
  /Unable to complete project graph creation/i,
  /plugin worker/i,
];

export function isNxBootstrapFailure(output: string): boolean {
  return BOOTSTRAP_PATTERNS.some((pattern) => pattern.test(output));
}

export function formatInvocation(args: string[]): string {
  return `pnpm ${args.join(" ")}`;
}

export function runPnpmCommand(
  args: string[],
  runner: SpawnRunner = spawnSync,
  env: NodeJS.ProcessEnv = process.env,
): NxBootstrapCommandResult {
  const result = runner("pnpm", args, {
    encoding: "utf-8",
    env: {
      ...env,
      NX_DAEMON: "false",
    },
  });

  return {
    status: result.status ?? 1,
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? "",
    error:
      result.error && typeof result.error.message === "string"
        ? result.error.message
        : null,
  };
}

export function runNxBootstrapCheck(options?: {
  runner?: SpawnRunner;
  writeStdout?: (text: string) => void;
  writeStderr?: (text: string) => void;
  env?: NodeJS.ProcessEnv;
  steps?: NxBootstrapStep[];
}): NxBootstrapCheckResult {
  const runner = options?.runner ?? spawnSync;
  const writeStdout =
    options?.writeStdout ?? ((text) => process.stdout.write(text));
  const writeStderr =
    options?.writeStderr ?? ((text) => process.stderr.write(text));
  const env = options?.env ?? process.env;
  const steps = options?.steps ?? DEFAULT_STEPS;

  for (const step of steps) {
    const result = runPnpmCommand(step.args, runner, env);
    const output = `${result.stdout}${result.stderr}${result.error ? `\n${result.error}` : ""}`;

    if (result.status === 0) {
      continue;
    }

    const invocation = formatInvocation(step.args);

    if (isNxBootstrapFailure(output)) {
      writeStderr(
        [
          `Nx bootstrap health check failed while running \`${invocation}\`.`,
          "",
          "Detected plugin bootstrap failure signatures.",
          "Run `pnpm quality:fallback` to validate plugin logic without Nx graph/bootstrap dependencies.",
          "Then capture diagnostics with `pnpm --version`, `pnpm nx --version`, and `node -v`.",
          "",
          output.trim(),
          "",
        ].join("\n"),
      );
      return { ok: false, bootstrapFailure: true, command: invocation };
    }

    writeStderr(
      [
        `Nx bootstrap health check failed while running \`${invocation}\`.`,
        "",
        output.trim(),
        "",
      ].join("\n"),
    );
    return { ok: false, bootstrapFailure: false, command: invocation };
  }

  writeStdout(
    "Nx bootstrap health check passed (pnpm nx report, pnpm nx show projects --json).\n",
  );
  return { ok: true, bootstrapFailure: false, command: null };
}

export function runNxBootstrapCheckCli(
  args: string[],
  checkRunner: (options?: {
    runner?: SpawnRunner;
    writeStdout?: (text: string) => void;
    writeStderr?: (text: string) => void;
    env?: NodeJS.ProcessEnv;
    steps?: NxBootstrapStep[];
  }) => NxBootstrapCheckResult = runNxBootstrapCheck,
): NxBootstrapCheckResult {
  if (args.length > 0) {
    throw new Error(`Unknown argument: ${args[0]}`);
  }

  return checkRunner();
}

/* c8 ignore start */
if (require.main === module) {
  const result = runNxBootstrapCheckCli(process.argv.slice(2));
  if (!result.ok) {
    process.exitCode = 1;
  }
}
/* c8 ignore stop */
