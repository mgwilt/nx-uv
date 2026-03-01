export type UvColorChoice = 'auto' | 'always' | 'never';

export interface UvBaseExecutorSchema {
  cwd?: string;
  directory?: string;
  project?: string;
  configFile?: string;
  noConfig?: boolean;
  offline?: boolean;
  noProgress?: boolean;
  quiet?: boolean;
  verbose?: boolean;
  color?: UvColorChoice;
  nativeTls?: boolean;
  cacheDir?: string;
  noCache?: boolean;
  managedPython?: boolean;
  noManagedPython?: boolean;
  noPythonDownloads?: boolean;
  allowInsecureHost?: string[];
  env?: Record<string, string>;
  extraArgs?: string[];
  skipVersionCheck?: boolean;
}
