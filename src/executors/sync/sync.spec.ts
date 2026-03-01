import { ExecutorContext } from '@nx/devkit';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const spawnSyncMock = vi.hoisted(() => vi.fn());

vi.mock('child_process', () => ({
  spawnSync: spawnSyncMock,
}));

import executor from './sync';
import { SyncExecutorSchema } from './schema';

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

describe('sync executor', () => {
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

  it('runs uv sync with package, frozen, and extra args', async () => {
    const options: SyncExecutorSchema = {
      package: 'shared',
      frozen: true,
      extraArgs: ['--all-groups'],
    };

    const result = await executor(options, context);

    expect(result.success).toBe(true);
    expect(spawnSyncMock).toHaveBeenCalledWith(
      'uv',
      ['sync', '--package', 'shared', '--frozen', '--all-groups'],
      {
        cwd: '/repo/packages/py/shared',
        env: process.env,
        stdio: 'inherit',
      },
    );
  });

  it('uses explicit cwd when provided', async () => {
    const options: SyncExecutorSchema = {
      cwd: 'tmp/workspace',
    };

    await executor(options, context);

    expect(spawnSyncMock).toHaveBeenCalledWith('uv', ['sync'], {
      cwd: '/repo/tmp/workspace',
      env: process.env,
      stdio: 'inherit',
    });
  });
});
