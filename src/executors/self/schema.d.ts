import { UvBaseExecutorSchema } from "../shared/options";

export type UvSelfCommand = "update" | "version";

export interface SelfExecutorSchema extends UvBaseExecutorSchema {
  command: UvSelfCommand;
  commandArgs?: string[];
}
