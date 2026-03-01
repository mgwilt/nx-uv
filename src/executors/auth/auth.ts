import { PromiseExecutor } from "@nx/devkit";
import { runUvCommand } from "../shared/run-uv";
import { AuthExecutorSchema } from "./schema";

const authExecutor: PromiseExecutor<AuthExecutorSchema> = async (
  options,
  context,
) => {
  const args = ["auth", options.command, ...(options.commandArgs ?? [])];
  return runUvCommand(args, options, context);
};

export default authExecutor;
