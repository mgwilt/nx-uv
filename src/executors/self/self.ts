import { PromiseExecutor } from "@nx/devkit";
import { runUvCommand } from "../shared/run-uv";
import { SelfExecutorSchema } from "./schema";

const selfExecutor: PromiseExecutor<SelfExecutorSchema> = async (
  options,
  context,
) => {
  const args = ["self", options.command, ...(options.commandArgs ?? [])];
  return runUvCommand(args, options, context);
};

export default selfExecutor;
