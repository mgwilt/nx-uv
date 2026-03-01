import { logger, PromiseExecutor } from "@nx/devkit";
import { RunExecutorSchema } from "./schema";
import { runUvCommand } from "../shared/run-uv";

const runExecutor: PromiseExecutor<RunExecutorSchema> = async (
  options,
  context,
) => {
  if (!options.command) {
    logger.error('The "command" option is required for the uv run executor.');
    return { success: false };
  }

  const args: string[] = ["run"];

  if (options.package) {
    args.push("--package", options.package);
  }

  if (options.python) {
    args.push("--python", options.python);
  }

  if (options.with?.length) {
    for (const dependency of options.with) {
      args.push("--with", dependency);
    }
  }

  args.push("--", options.command, ...(options.args ?? []));

  return runUvCommand(args, options, context);
};

export default runExecutor;
