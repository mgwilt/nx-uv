import {
  names,
  readJson,
  TargetConfiguration,
  Tree,
  updateJson,
  workspaceRoot,
} from '@nx/devkit';
import * as path from 'path';

export type InferencePreset = 'minimal' | 'standard' | 'full';

export function normalizePythonProjectName(name: string): string {
  return names(name).fileName;
}

export function toModuleName(name: string): string {
  return normalizePythonProjectName(name).replace(/-/g, '_');
}

export function parseTags(tags: string | undefined): string[] {
  if (!tags) {
    return [];
  }

  return tags
    .split(',')
    .map((tag) => tag.trim())
    .filter(Boolean);
}

export function defaultUvTargets(projectRoot: string): Record<string, TargetConfiguration> {
  const cwd = projectRoot;

  return {
    sync: {
      executor: '@mgwilt/nx-uv:project',
      options: {
        cwd,
        command: 'sync',
      },
    },
    lock: {
      executor: '@mgwilt/nx-uv:project',
      options: {
        cwd,
        command: 'lock',
      },
    },
    tree: {
      executor: '@mgwilt/nx-uv:project',
      options: {
        cwd,
        command: 'tree',
      },
    },
    run: {
      executor: '@mgwilt/nx-uv:project',
      options: {
        cwd,
        command: 'run',
        commandArgs: ['--', 'python', '-V'],
      },
    },
    test: {
      executor: '@mgwilt/nx-uv:project',
      options: {
        cwd,
        command: 'run',
        commandArgs: ['--', 'pytest', '-q'],
      },
    },
    lint: {
      executor: '@mgwilt/nx-uv:project',
      options: {
        cwd,
        command: 'run',
        commandArgs: ['--', 'ruff', 'check', '.'],
      },
    },
    format: {
      executor: '@mgwilt/nx-uv:project',
      options: {
        cwd,
        command: 'format',
      },
    },
    build: {
      executor: '@mgwilt/nx-uv:project',
      options: {
        cwd,
        command: 'build',
      },
    },
  };
}

export function ensureNxUvPlugin(
  tree: Tree,
  options: {
    targetPrefix?: string;
    inferencePreset?: InferencePreset;
    includeGlobalTargets?: boolean;
  },
): void {
  if (!tree.exists('nx.json')) {
    return;
  }

  updateJson(tree, 'nx.json', (json) => {
    const plugins = Array.isArray(json.plugins) ? [...json.plugins] : [];
    const existingIndex = plugins.findIndex((entry) => {
      if (typeof entry === 'string') {
        return entry === '@mgwilt/nx-uv';
      }

      return entry?.plugin === '@mgwilt/nx-uv';
    });

    const pluginEntry = {
      plugin: '@mgwilt/nx-uv',
      options: {
        targetPrefix: options.targetPrefix ?? 'uv:',
        inferencePreset: options.inferencePreset ?? 'standard',
        includeGlobalTargets: options.includeGlobalTargets ?? false,
      },
    };

    if (existingIndex === -1) {
      plugins.push(pluginEntry);
    } else {
      const current = plugins[existingIndex];
      if (typeof current === 'string') {
        plugins[existingIndex] = pluginEntry;
      } else {
        plugins[existingIndex] = {
          ...current,
          options: {
            ...(current.options ?? {}),
            ...pluginEntry.options,
          },
        };
      }
    }

    return {
      ...json,
      plugins,
    };
  });
}

export function relativeToWorkspaceRoot(targetPath: string): string {
  const absoluteTarget = path.resolve(workspaceRoot, targetPath);
  return path.relative(workspaceRoot, absoluteTarget) || '.';
}

export function readNxProjectMap(tree: Tree): Record<string, { root: string }> {
  if (!tree.exists('nx.json')) {
    return {};
  }

  const nxJson = readJson(tree, 'nx.json');
  const projects = (nxJson.projects ?? {}) as Record<string, { root: string }>;
  return projects;
}
