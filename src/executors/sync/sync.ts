import { PromiseExecutor } from '@nx/devkit';
import { SyncExecutorSchema } from './schema';
import { runUvCommand } from '../shared/run-uv';

const syncExecutor: PromiseExecutor<SyncExecutorSchema> = async (
  options,
  context,
) => {
  const args: string[] = ['sync'];

  if (options.package) {
    args.push('--package', options.package);
  }

  if (options.frozen) {
    args.push('--frozen');
  }

  if (options.extraArgs?.length) {
    args.push(...options.extraArgs);
  }

  return runUvCommand(args, options, context);
};

export default syncExecutor;
