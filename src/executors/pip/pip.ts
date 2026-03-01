import { PromiseExecutor } from '@nx/devkit';
import { runUvCommand } from '../shared/run-uv';
import { PipExecutorSchema } from './schema';

const pipExecutor: PromiseExecutor<PipExecutorSchema> = async (options, context) => {
  const args = ['pip', options.command, ...(options.commandArgs ?? [])];
  return runUvCommand(args, options, context);
};

export default pipExecutor;
