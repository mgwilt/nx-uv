export interface AddExecutorSchema {
  cwd?: string;
  package?: string;
  dev?: boolean;
  group?: string;
  dependencies: string[];
  extraArgs?: string[];
}
