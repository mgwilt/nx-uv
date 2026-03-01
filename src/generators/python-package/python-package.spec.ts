import {
  readJson,
  readProjectConfiguration,
  Tree,
} from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';

import { convertGenerator } from '../convert/convert';
import { projectGenerator } from '../project/project';
import { workspaceGenerator } from '../workspace/workspace';

describe('uv generators', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
  });

  it('configures workspace plugin and root pyproject', async () => {
    await workspaceGenerator(tree, {
      name: 'mono',
      targetPrefix: 'uv:',
      inferencePreset: 'standard',
      includeGlobalTargets: true,
      skipFormat: true,
    });

    const nxJson = readJson(tree, 'nx.json');

    expect(tree.exists('pyproject.toml')).toBe(true);
    expect(nxJson.plugins).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          plugin: '@mgwilt/nx-uv',
        }),
      ]),
    );
  });

  it('creates a Python project with new uv targets', async () => {
    await projectGenerator(tree, {
      name: 'shared',
      projectType: 'lib',
      skipFormat: true,
    });

    const config = readProjectConfiguration(tree, 'shared');

    expect(config.targets['sync'].executor).toBe('@mgwilt/nx-uv:project');
    expect(config.targets['uv'].executor).toBe('@mgwilt/nx-uv:uv');
    expect(tree.exists('packages/py/shared/pyproject.toml')).toBe(true);
    expect(tree.exists('packages/py/shared/src/shared/__init__.py')).toBe(true);
  });

  it('adds default uv targets to existing pyproject project', async () => {
    await projectGenerator(tree, {
      name: 'existing',
      projectType: 'lib',
      skipFormat: true,
    });

    await convertGenerator(tree, { project: 'existing', skipFormat: true });

    const converted = readProjectConfiguration(tree, 'existing');
    expect(converted.targets['sync'].executor).toBe('@mgwilt/nx-uv:project');
    expect(converted.targets['uv'].executor).toBe('@mgwilt/nx-uv:uv');
  });
});
