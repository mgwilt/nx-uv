import { ExecutorContext } from '@nx/devkit';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const spawnSyncMock = vi.hoisted(() => vi.fn());

vi.mock('child_process', () => ({
  spawnSync: spawnSyncMock,
}));

import executor from '../project/project';
import { ProjectExecutorSchema } from '../project/schema';

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

function mockUvSuccess() {
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
}

describe('project executor', () => {
  beforeEach(() => {
    spawnSyncMock.mockReset();
    mockUvSuccess();
  });

  it('runs uv project command after version check', async () => {
    const options: ProjectExecutorSchema = {
      command: 'run',
      commandArgs: ['--', 'pytest', '-q'],
      cwd: 'packages/py/shared',
      extraArgs: ['--offline'],
    };

    const result = await executor(options, context);

    expect(result.success).toBe(true);
    expect(spawnSyncMock).toHaveBeenNthCalledWith(
      1,
      'uv',
      ['--version'],
      expect.objectContaining({
        cwd: '/repo/packages/py/shared',
        stdio: 'pipe',
      }),
    );
    expect(spawnSyncMock).toHaveBeenNthCalledWith(
      2,
      'uv',
      ['run', '--', 'pytest', '-q', '--offline'],
      expect.objectContaining({
        cwd: '/repo/packages/py/shared',
        stdio: 'inherit',
      }),
    );
  });
});
