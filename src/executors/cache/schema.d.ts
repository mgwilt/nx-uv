import { UvBaseExecutorSchema } from '../shared/options';

export type UvCacheCommand = 'clean' | 'prune' | 'dir' | 'size';

export interface CacheExecutorSchema extends UvBaseExecutorSchema {
  command: UvCacheCommand;
  commandArgs?: string[];
}
