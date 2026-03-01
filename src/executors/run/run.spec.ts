import { ExecutorContext } from '@nx/devkit';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const spawnSyncMock = vi.hoisted(() => vi.fn());

vi.mock('child_process', () => ({
  spawnSync: spawnSyncMock,
}));

import executor from './run';
import { RunExecutorSchema } from './schema';

const context: ExecutorContext = {
  root: '/repo',
  cwd: '/repo',
  isVerbose: false,
  projectName: 'shared',
  projectGraph: {
    nodes: {},
    dependencies: {},
  },
  projectsConfigurations: {
    version: 2,
    projects: {
      shared: {
        root: 'packages/py/shared',
        sourceRoot: 'packages/py/shared/src',
        projectType: 'library',
        targets: {},
      },
    },
  },
  nxJsonConfiguration: {},
};

describe('run executor', () => {
  beforeEach(() => {
    spawnSyncMock.mockReset();
    spawnSyncMock.mockReturnValue({
      status: 0,
      pid: 1,
      output: [],
      stdout: null,
      stderr: null,
      signal: null,
    });
  });

  it('runs uv run with full command options', async () => {
    const options: RunExecutorSchema = {
      command: 'pytest',
      args: ['-q'],
      python: '3.12',
      with: ['pytest>=8', 'ruff>=0.5'],
      extraArgs: ['--no-project'],
      package: 'shared',
    };

    const result = await executor(options, context);

    expect(result.success).toBe(true);
    expect(spawnSyncMock).toHaveBeenCalledWith(
      'uv',
      [
        'run',
        '--package',
        'shared',
        '--python',
        '3.12',
        '--with',
        'pytest>=8',
        '--with',
        'ruff>=0.5',
        '--no-project',
        '--',
        'pytest',
        '-q',
      ],
      {
        cwd: '/repo/packages/py/shared',
        env: process.env,
        stdio: 'inherit',
      },
    );
  });

  it('fails when command is missing', async () => {
    const result = await executor({} as RunExecutorSchema, context);

    expect(result.success).toBe(false);
    expect(spawnSyncMock).not.toHaveBeenCalled();
  });
});
