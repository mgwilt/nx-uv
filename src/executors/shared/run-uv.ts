import { ExecutorContext, logger } from '@nx/devkit';
import * as childProcess from 'child_process';
import * as path from 'path';

type BaseExecutorOptions = {
  cwd?: string;
};

export function resolveWorkingDirectory(
  options: BaseExecutorOptions,
  context: ExecutorContext,
): string {
  if (options.cwd) {
    return path.resolve(context.root, options.cwd);
  }

  const projectName = context.projectName;
  const projectRoot =
    projectName && context.projectsConfigurations?.projects?.[projectName]?.root;

  if (projectRoot) {
    return path.resolve(context.root, projectRoot);
  }

  return context.root;
}

export function runUvCommand(
  args: string[],
  options: BaseExecutorOptions,
  context: ExecutorContext,
): { success: boolean } {
  const cwd = resolveWorkingDirectory(options, context);

  logger.info(`Running: uv ${args.join(' ')}`);
  logger.info(`Working directory: ${cwd}`);

  const result = childProcess.spawnSync('uv', args, {
    cwd,
    env: process.env,
    stdio: 'inherit',
  });

  if (result.error) {
    logger.error(result.error.message);
    return { success: false };
  }

  return { success: result.status === 0 };
}
