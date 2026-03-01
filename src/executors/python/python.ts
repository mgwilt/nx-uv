import { PromiseExecutor } from '@nx/devkit';
import { runUvCommand } from '../shared/run-uv';
import { PythonExecutorSchema } from './schema';

const pythonExecutor: PromiseExecutor<PythonExecutorSchema> = async (
  options,
  context,
) => {
  const args = ['python', options.command, ...(options.commandArgs ?? [])];
  return runUvCommand(args, options, context);
};

export default pythonExecutor;
