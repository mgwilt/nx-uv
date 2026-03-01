import {
  formatFiles,
  getProjects,
  readProjectConfiguration,
  Tree,
  updateProjectConfiguration,
} from "@nx/devkit";
import { defaultUvTargets, ensureNxUvPlugin } from "../shared";
import { ConvertGeneratorSchema } from "./schema";

export async function convertGenerator(
  tree: Tree,
  options: ConvertGeneratorSchema,
) {
  const projects = getProjects(tree);

  for (const [projectName, projectConfig] of projects) {
    if (options.project && projectName !== options.project) {
      continue;
    }

    const pyprojectPath = `${projectConfig.root}/pyproject.toml`;
    if (!tree.exists(pyprojectPath)) {
      continue;
    }

    const config = readProjectConfiguration(tree, projectName);
    const currentTargets = { ...(config.targets ?? {}) };

    const defaults = defaultUvTargets(config.root);
    for (const [targetName, targetConfig] of Object.entries(defaults)) {
      if (!currentTargets[targetName]) {
        currentTargets[targetName] = targetConfig;
      }
    }

    if (!currentTargets["uv"]) {
      currentTargets["uv"] = {
        executor: "@mgwilt/nx-uv:uv",
        options: {
          cwd: config.root,
          args: ["help"],
        },
      };
    }

    updateProjectConfiguration(tree, projectName, {
      ...config,
      targets: currentTargets,
    });
  }

  ensureNxUvPlugin(tree, {
    targetPrefix: "uv:",
    inferencePreset: "standard",
    includeGlobalTargets: false,
  });

  if (!options.skipFormat) {
    await formatFiles(tree);
  }
}

export default convertGenerator;
