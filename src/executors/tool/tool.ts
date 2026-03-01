import { PromiseExecutor } from '@nx/devkit';
import { runUvCommand } from '../shared/run-uv';
import { ToolExecutorSchema } from './schema';

const toolExecutor: PromiseExecutor<ToolExecutorSchema> = async (options, context) => {
  const args = ['tool', options.command, ...(options.commandArgs ?? [])];
  return runUvCommand(args, options, context);
};

export default toolExecutor;
