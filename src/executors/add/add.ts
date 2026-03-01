import { logger, PromiseExecutor } from "@nx/devkit";
import { AddExecutorSchema } from "./schema";
import { runUvCommand } from "../shared/run-uv";

const addExecutor: PromiseExecutor<AddExecutorSchema> = async (
  options,
  context,
) => {
  if (!options.dependencies?.length) {
    logger.error("Provide at least one dependency for the uv add executor.");
    return { success: false };
  }

  const args: string[] = ["add"];

  if (options.package) {
    args.push("--package", options.package);
  }

  if (options.dev) {
    args.push("--dev");
  }

  if (options.group) {
    args.push("--group", options.group);
  }

  args.push(...options.dependencies);

  return runUvCommand(args, options, context);
};

export default addExecutor;
