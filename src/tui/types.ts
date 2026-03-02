export type TuiView =
  | "dashboard"
  | "workspace"
  | "project"
  | "integration"
  | "convert"
  | "inference"
  | "tasks"
  | "uv";

export type TuiLaunchOptions = {
  cwd?: string;
  readonly?: boolean;
  initialView?: TuiView;
};

export type NxUvPluginOptions = {
  targetPrefix?: string;
  inferencePreset?: "minimal" | "standard" | "full";
  includeGlobalTargets?: boolean;
  inferredTargets?: Record<
    string,
    false | { command?: string; commandArgs?: string[] }
  >;
};

export type ProjectSnapshot = {
  name: string;
  root: string;
  projectType: string;
  tags: string[];
  targets: string[];
  hasPyproject: boolean;
};

export type WorkspaceSnapshot = {
  workspaceRoot: string;
  hasRootPyproject: boolean;
  hasUvWorkspaceTable: boolean;
  uvVersion: string | null;
  pluginConfigured: boolean;
  pluginOptions: NxUvPluginOptions;
  projects: ProjectSnapshot[];
};

export type CommandSpec = {
  command: string;
  args: string[];
  cwd: string;
  env?: Record<string, string>;
};

export type CommandResult = {
  command: CommandSpec;
  ok: boolean;
  status: number | null;
  stdout: string;
  stderr: string;
  error?: string;
};

export type FileChange = {
  operation: "CREATE" | "UPDATE" | "DELETE";
  path: string;
};

export type ActionPreview = {
  summary: string;
  commands: string[];
  fileChanges: FileChange[];
  stdout: string;
  stderr: string;
};

export type CommandPlan = {
  kind: "command";
  title: string;
  summary: string;
  mutatesRepo: boolean;
  apply: CommandSpec;
  preview?: CommandSpec;
};

export type PatchPlan = {
  kind: "patch";
  title: string;
  summary: string;
  path: string;
  before: string;
  after: string;
  diff: string;
};

export type PlannedAction = CommandPlan | PatchPlan;

export type ApplyResult = {
  success: boolean;
  summary: string;
  stdout: string;
  stderr: string;
};
