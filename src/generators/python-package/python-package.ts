import {
  addProjectConfiguration,
  formatFiles,
  generateFiles,
  joinPathFragments,
  names,
  Tree,
} from '@nx/devkit';
import * as path from 'path';
import { PythonPackageGeneratorSchema } from './schema';

type NormalizedOptions = {
  directory: string;
  moduleName: string;
  name: string;
  packageName: string;
  projectName: string;
  projectRoot: string;
  tags: string[];
  withTests: boolean;
};

export async function pythonPackageGenerator(
  tree: Tree,
  options: PythonPackageGeneratorSchema,
) {
  const normalized = normalizeOptions(options);

  addProjectConfiguration(tree, normalized.projectName, {
    root: normalized.projectRoot,
    projectType: 'library',
    sourceRoot: `${normalized.projectRoot}/src`,
    tags: normalized.tags,
    targets: {
      sync: {
        executor: '@mgwilt/nx-uv:sync',
        options: {
          cwd: normalized.projectRoot,
        },
      },
      add: {
        executor: '@mgwilt/nx-uv:add',
        options: {
          cwd: normalized.projectRoot,
        },
      },
      run: {
        executor: '@mgwilt/nx-uv:run',
        options: {
          cwd: normalized.projectRoot,
          command: 'python',
          args: ['-V'],
        },
      },
      test: {
        executor: '@mgwilt/nx-uv:run',
        options: {
          cwd: normalized.projectRoot,
          command: 'pytest',
          with: ['pytest>=8.0.0'],
        },
      },
      lint: {
        executor: '@mgwilt/nx-uv:run',
        options: {
          cwd: normalized.projectRoot,
          command: 'ruff',
          args: ['check', '.'],
          with: ['ruff>=0.5.0'],
        },
      },
    },
  });

  generateFiles(
    tree,
    path.join(__dirname, 'files/package'),
    normalized.projectRoot,
    {
      ...normalized,
      tmpl: '',
    },
  );

  if (!normalized.withTests) {
    tree.delete(`${normalized.projectRoot}/tests/test_smoke.py`);
  }

  await formatFiles(tree);
}

function normalizeOptions(
  options: PythonPackageGeneratorSchema,
): NormalizedOptions {
  const trimmedName = options.name.trim();
  const nameSegments = trimmedName.split('/').filter(Boolean);

  let directory = options.directory?.trim();
  let name = trimmedName;

  if (nameSegments.length > 1) {
    name = nameSegments[nameSegments.length - 1];
    if (!directory) {
      directory = nameSegments.slice(0, -1).join('/');
    }
  }

  const normalizedName = names(name).fileName;
  const normalizedDirectory = directory
    ? directory.replace(/\\/g, '/').replace(/^\/+|\/+$/g, '')
    : 'packages/py';

  const projectRoot = joinPathFragments(normalizedDirectory, normalizedName);

  return {
    name: normalizedName,
    projectName: normalizedName,
    packageName: normalizedName.replace(/_/g, '-'),
    directory: normalizedDirectory,
    projectRoot,
    moduleName: options.moduleName
      ? names(options.moduleName).fileName.replace(/-/g, '_')
      : normalizedName.replace(/-/g, '_'),
    tags: options.tags
      ? options.tags
          .split(',')
          .map((tag) => tag.trim())
          .filter(Boolean)
      : [],
    withTests: options.withTests ?? true,
  };
}

export default pythonPackageGenerator;
