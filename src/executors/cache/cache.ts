import { PromiseExecutor } from "@nx/devkit";
import { runUvCommand } from "../shared/run-uv";
import { CacheExecutorSchema } from "./schema";

const cacheExecutor: PromiseExecutor<CacheExecutorSchema> = async (
  options,
  context,
) => {
  const args = ["cache", options.command, ...(options.commandArgs ?? [])];
  return runUvCommand(args, options, context);
};

export default cacheExecutor;
