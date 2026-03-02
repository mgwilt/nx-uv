#!/usr/bin/env node

import { runNxUvTui, TuiLaunchOptions } from "../tui";

async function main(argv = process.argv.slice(2)): Promise<number> {
  const [command, ...args] = argv;

  if (command !== "tui") {
    writeUsage();
    return command ? 1 : 0;
  }

  const options = parseTuiOptions(args);
  const result = await runNxUvTui(options);
  return result.success ? 0 : 1;
}

function parseTuiOptions(argv: string[]): TuiLaunchOptions {
  const options: TuiLaunchOptions = {};

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === "--readonly") {
      options.readonly = true;
      continue;
    }

    if (arg === "--cwd") {
      options.cwd = argv[index + 1];
      index += 1;
      continue;
    }

    if (arg.startsWith("--cwd=")) {
      options.cwd = arg.slice("--cwd=".length);
      continue;
    }

    if (arg === "--initial-view") {
      options.initialView = argv[index + 1] as TuiLaunchOptions["initialView"];
      index += 1;
      continue;
    }

    if (arg.startsWith("--initial-view=")) {
      options.initialView = arg.slice(
        "--initial-view=".length,
      ) as TuiLaunchOptions["initialView"];
      continue;
    }
  }

  return options;
}

function writeUsage(): void {
  process.stdout.write(
    [
      "nx-uv studio",
      "",
      "Usage:",
      "  nx-uv tui [--cwd <path>] [--readonly] [--initial-view <view>]",
      "",
      "Examples:",
      "  pnpm dlx -p @mgwilt/nx-uv nx-uv tui",
      "  pnpm dlx @mgwilt/nx-uv tui",
      "",
    ].join("\n"),
  );
}

main()
  .then((code) => {
    process.exitCode = code;
  })
  .catch((error: unknown) => {
    process.stderr.write(
      `${error instanceof Error ? error.stack : String(error)}\n`,
    );
    process.exitCode = 1;
  });
