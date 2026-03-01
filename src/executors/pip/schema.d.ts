import { UvBaseExecutorSchema } from '../shared/options';

export type UvPipCommand =
  | 'compile'
  | 'sync'
  | 'install'
  | 'uninstall'
  | 'freeze'
  | 'list'
  | 'show'
  | 'tree'
  | 'check';

export interface PipExecutorSchema extends UvBaseExecutorSchema {
  command: UvPipCommand;
  commandArgs?: string[];
}
