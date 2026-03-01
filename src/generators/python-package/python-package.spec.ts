import { readProjectConfiguration, Tree } from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';

import { pythonPackageGenerator } from './python-package';
import { PythonPackageGeneratorSchema } from './schema';

describe('python-package generator', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
  });

  it('creates a package with default paths and uv targets', async () => {
    const options: PythonPackageGeneratorSchema = { name: 'shared' };

    await pythonPackageGenerator(tree, options);

    const config = readProjectConfiguration(tree, 'shared');

    expect(config.root).toBe('packages/py/shared');
    expect(config.targets['sync'].executor).toBe('@mgwilt/nx-uv:sync');
    expect(config.targets['add'].executor).toBe('@mgwilt/nx-uv:add');
    expect(config.targets['run'].executor).toBe('@mgwilt/nx-uv:run');
    expect(tree.exists('packages/py/shared/pyproject.toml')).toBe(true);
    expect(tree.exists('packages/py/shared/src/shared/__init__.py')).toBe(true);
    expect(tree.exists('packages/py/shared/tests/test_smoke.py')).toBe(true);
  });

  it('handles full path names and custom module names', async () => {
    const options: PythonPackageGeneratorSchema = {
      name: 'packages/py/analytics',
      moduleName: 'analytics_core',
      withTests: false,
      tags: 'python,shared',
    };

    await pythonPackageGenerator(tree, options);

    const config = readProjectConfiguration(tree, 'analytics');

    expect(config.root).toBe('packages/py/analytics');
    expect(config.tags).toEqual(['python', 'shared']);
    expect(tree.exists('packages/py/analytics/src/analytics_core/__init__.py')).toBe(
      true,
    );
    expect(tree.exists('packages/py/analytics/tests/test_smoke.py')).toBe(false);
  });
});
