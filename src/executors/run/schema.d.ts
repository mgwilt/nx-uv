export interface RunExecutorSchema {
  cwd?: string;
  package?: string;
  python?: string;
  with?: string[];
  command: string;
  args?: string[];
  extraArgs?: string[];
}
