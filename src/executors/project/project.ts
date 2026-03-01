import { PromiseExecutor } from "@nx/devkit";
import { runUvCommand } from "../shared/run-uv";
import { ProjectExecutorSchema } from "./schema";

const projectExecutor: PromiseExecutor<ProjectExecutorSchema> = async (
  options,
  context,
) => {
  const args = [options.command, ...(options.commandArgs ?? [])];
  return runUvCommand(args, options, context);
};

export default projectExecutor;
