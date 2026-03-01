import { UvBaseExecutorSchema } from "../shared/options";

export type UvAuthCommand = "login" | "logout" | "token" | "dir";

export interface AuthExecutorSchema extends UvBaseExecutorSchema {
  command: UvAuthCommand;
  commandArgs?: string[];
}
