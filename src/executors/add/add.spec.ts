import { ExecutorContext } from '@nx/devkit';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const spawnSyncMock = vi.hoisted(() => vi.fn());

vi.mock('child_process', () => ({
  spawnSync: spawnSyncMock,
}));

import executor from './add';
import { AddExecutorSchema } from './schema';

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

describe('add executor', () => {
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

  it('runs uv add with dependencies and options', async () => {
    const options: AddExecutorSchema = {
      package: 'shared',
      dev: true,
      group: 'lint',
      dependencies: ['ruff>=0.5', 'pytest>=8'],
      extraArgs: ['--frozen'],
    };

    const result = await executor(options, context);

    expect(result.success).toBe(true);
    expect(spawnSyncMock).toHaveBeenCalledWith(
      'uv',
      [
        'add',
        '--package',
        'shared',
        '--dev',
        '--group',
        'lint',
        '--frozen',
        'ruff>=0.5',
        'pytest>=8',
      ],
      {
        cwd: '/repo/packages/py/shared',
        env: process.env,
        stdio: 'inherit',
      },
    );
  });

  it('fails when dependencies are missing', async () => {
    const result = await executor({} as AddExecutorSchema, context);

    expect(result.success).toBe(false);
    expect(spawnSyncMock).not.toHaveBeenCalled();
  });
});
