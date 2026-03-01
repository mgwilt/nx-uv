export const name = "@mgwilt/nx-uv";

export { createNodesV2 } from "./plugins/create-nodes";
export type { NxUvPluginOptions } from "./plugins/create-nodes";

export { default as uvExecutor } from "./executors/uv/uv";
export type { UvExecutorSchema } from "./executors/uv/schema";

export { default as projectExecutor } from "./executors/project/project";
export type {
  ProjectExecutorSchema,
  UvProjectCommand,
} from "./executors/project/schema";

export { default as pipExecutor } from "./executors/pip/pip";
export type { PipExecutorSchema, UvPipCommand } from "./executors/pip/schema";

export { default as toolExecutor } from "./executors/tool/tool";
export type {
  ToolExecutorSchema,
  UvToolCommand,
} from "./executors/tool/schema";

export { default as pythonExecutor } from "./executors/python/python";
export type {
  PythonExecutorSchema,
  UvPythonCommand,
} from "./executors/python/schema";

export { default as authExecutor } from "./executors/auth/auth";
export type {
  AuthExecutorSchema,
  UvAuthCommand,
} from "./executors/auth/schema";

export { default as cacheExecutor } from "./executors/cache/cache";
export type {
  CacheExecutorSchema,
  UvCacheCommand,
} from "./executors/cache/schema";

export { default as selfExecutor } from "./executors/self/self";
export type {
  SelfExecutorSchema,
  UvSelfCommand,
} from "./executors/self/schema";

export { default as workspaceGenerator } from "./generators/workspace/workspace";
export type { WorkspaceGeneratorSchema } from "./generators/workspace/schema";

export { default as projectGenerator } from "./generators/project/project";
export type { ProjectGeneratorSchema } from "./generators/project/schema";

export { default as convertGenerator } from "./generators/convert/convert";
export type { ConvertGeneratorSchema } from "./generators/convert/schema";

export { default as integrationGenerator } from "./generators/integration/integration";
export type {
  IntegrationGeneratorSchema,
  IntegrationTemplate,
} from "./generators/integration/schema";
