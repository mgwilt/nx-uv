import { ExecutorContext } from '@nx/devkit';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const spawnSyncMock = vi.hoisted(() => vi.fn());

vi.mock('child_process', () => ({
  spawnSync: spawnSyncMock,
}));

import executor from '../uv/uv';
import { UvExecutorSchema } from '../uv/schema';

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

describe('uv executor', () => {
  beforeEach(() => {
    spawnSyncMock.mockReset();
  });

  it('fails version check for unsupported uv versions', async () => {
    spawnSyncMock.mockReturnValue({
      status: 0,
      stdout: 'uv 1.0.0\n',
      stderr: '',
      pid: 1,
      output: [],
      signal: null,
    });

    const options: UvExecutorSchema = {
      args: ['help'],
    };

    const result = await executor(options, context);

    expect(result.success).toBe(false);
    expect(spawnSyncMock).toHaveBeenCalledTimes(1);
  });

  it('runs universal uv args', async () => {
    spawnSyncMock.mockImplementation((_command: string, args: string[]) => {
      if (args[0] === '--version') {
        return {
          status: 0,
          stdout: 'uv 0.9.29\n',
          stderr: '',
          pid: 1,
          output: [],
          signal: null,
        };
      }

      return {
        status: 0,
        stdout: '',
        stderr: '',
        pid: 1,
        output: [],
        signal: null,
      };
    });

    const options: UvExecutorSchema = {
      args: ['cache', 'size'],
      cwd: 'packages/py/shared',
    };

    const result = await executor(options, context);

    expect(result.success).toBe(true);
    expect(spawnSyncMock).toHaveBeenNthCalledWith(
      2,
      'uv',
      ['cache', 'size'],
      expect.objectContaining({ cwd: '/repo/packages/py/shared' }),
    );
  });
});
