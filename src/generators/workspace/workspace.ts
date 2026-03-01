import {
  formatFiles,
  names,
  Tree,
  workspaceRoot,
} from '@nx/devkit';
import * as path from 'path';
import { ensureNxUvPlugin } from '../shared';
import { WorkspaceGeneratorSchema } from './schema';

export async function workspaceGenerator(
  tree: Tree,
  options: WorkspaceGeneratorSchema,
) {
  const membersGlob = options.membersGlob?.trim() || 'packages/py/*';
  const exclude = options.exclude
    ? options.exclude
        .split(',')
        .map((value) => value.trim())
        .filter(Boolean)
    : [];

  ensureRootPyproject(tree, {
    name: options.name,
    membersGlob,
    exclude,
  });

  ensureNxUvPlugin(tree, {
    targetPrefix: options.targetPrefix,
    inferencePreset: options.inferencePreset,
    includeGlobalTargets: options.includeGlobalTargets,
  });

  if (!options.skipFormat) {
    await formatFiles(tree);
  }
}

function ensureRootPyproject(
  tree: Tree,
  config: {
    name?: string;
    membersGlob: string;
    exclude: string[];
  },
): void {
  const rootPyproject = 'pyproject.toml';

  if (!tree.exists(rootPyproject)) {
    const normalizedName = config.name
      ? names(config.name).fileName
      : names(path.basename(workspaceRoot)).fileName;

    const toml = [
      '[project]',
      `name = "${normalizedName}"`,
      'version = "0.1.0"',
      'description = "uv workspace root"',
      'requires-python = ">=3.11"',
      'dependencies = []',
      '',
      '[tool.uv.workspace]',
      `members = ["${config.membersGlob}"]`,
    ];

    if (config.exclude.length) {
      const excludes = config.exclude.map((entry) => `"${entry}"`).join(', ');
      toml.push(`exclude = [${excludes}]`);
    }

    tree.write(rootPyproject, `${toml.join('\n')}\n`);
    return;
  }

  const current = tree.read(rootPyproject, 'utf-8') ?? '';

  if (current.includes('[tool.uv.workspace]')) {
    return;
  }

  const lines = [
    '',
    '[tool.uv.workspace]',
    `members = ["${config.membersGlob}"]`,
  ];

  if (config.exclude.length) {
    const excludes = config.exclude.map((entry) => `"${entry}"`).join(', ');
    lines.push(`exclude = [${excludes}]`);
  }

  tree.write(rootPyproject, `${current.trimEnd()}\n${lines.join('\n')}\n`);
}

export default workspaceGenerator;
