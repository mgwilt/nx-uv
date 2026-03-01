import { UvBaseExecutorSchema } from '../shared/options';

export type UvProjectCommand =
  | 'run'
  | 'init'
  | 'add'
  | 'remove'
  | 'version'
  | 'sync'
  | 'lock'
  | 'export'
  | 'tree'
  | 'format'
  | 'venv'
  | 'build'
  | 'publish';

export interface ProjectExecutorSchema extends UvBaseExecutorSchema {
  command: UvProjectCommand;
  commandArgs?: string[];
}
