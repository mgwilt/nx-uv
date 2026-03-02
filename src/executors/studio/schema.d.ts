export type StudioInitialView =
  | "dashboard"
  | "workspace"
  | "project"
  | "integration"
  | "convert"
  | "inference"
  | "tasks"
  | "uv";

export interface StudioExecutorSchema {
  cwd?: string;
  readonly?: boolean;
  initialView?: StudioInitialView;
}
