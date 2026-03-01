import { UvBaseExecutorSchema } from "../shared/options";

export type UvToolCommand =
  | "run"
  | "install"
  | "upgrade"
  | "list"
  | "uninstall"
  | "update-shell"
  | "dir";

export interface ToolExecutorSchema extends UvBaseExecutorSchema {
  command: UvToolCommand;
  commandArgs?: string[];
}
