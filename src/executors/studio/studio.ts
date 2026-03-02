import { PromiseExecutor } from "@nx/devkit";
import { runNxUvTui } from "../../tui";
import { StudioExecutorSchema } from "./schema";

const studioExecutor: PromiseExecutor<StudioExecutorSchema> = async (
  options,
  context,
) => {
  const result = await runNxUvTui({
    cwd: options.cwd ?? context.root,
    readonly: options.readonly ?? false,
    initialView: options.initialView ?? "dashboard",
  });

  return { success: result.success };
};

export default studioExecutor;
