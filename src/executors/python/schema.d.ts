import { UvBaseExecutorSchema } from '../shared/options';

export type UvPythonCommand =
  | 'list'
  | 'install'
  | 'upgrade'
  | 'find'
  | 'pin'
  | 'dir'
  | 'uninstall'
  | 'update-shell';

export interface PythonExecutorSchema extends UvBaseExecutorSchema {
  command: UvPythonCommand;
  commandArgs?: string[];
}
