import { logger, PromiseExecutor } from "@nx/devkit";
import { runUvCommand } from "../shared/run-uv";
import { UvExecutorSchema } from "./schema";

const uvExecutor: PromiseExecutor<UvExecutorSchema> = async (
  options,
  context,
) => {
  if (!options.args?.length) {
    logger.error(
      'The "args" option is required for the uv universal executor.',
    );
    return { success: false };
  }

  return runUvCommand(options.args, options, context);
};

export default uvExecutor;
