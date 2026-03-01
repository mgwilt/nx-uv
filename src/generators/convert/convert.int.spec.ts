import {
  addProjectConfiguration,
  readProjectConfiguration,
  Tree,
  updateProjectConfiguration,
} from "@nx/devkit";
import { createTreeWithEmptyWorkspace } from "@nx/devkit/testing";

import { projectGenerator } from "../project/project";
import { convertGenerator } from "./convert";

describe("convert generator", () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
  });

  it("adds default uv targets and universal executor for pyproject projects", async () => {
    await projectGenerator(tree, {
      name: "existing",
      projectType: "lib",
      skipFormat: true,
    });

    updateProjectConfiguration(tree, "existing", {
      ...readProjectConfiguration(tree, "existing"),
      targets: {
        custom: {
          executor: "nx:run-commands",
          options: {
            command: "echo custom",
          },
        },
      },
    });

    await convertGenerator(tree, {
      project: "existing",
      skipFormat: true,
    });

    const config = readProjectConfiguration(tree, "existing");

    expect(config.targets).toEqual(
      expect.objectContaining({
        custom: expect.any(Object),
        sync: expect.any(Object),
        lock: expect.any(Object),
        uv: expect.objectContaining({
          executor: "@mgwilt/nx-uv:uv",
        }),
      }),
    );
  });

  it("does not override existing uv target", async () => {
    await projectGenerator(tree, {
      name: "keep-uv-target",
      projectType: "lib",
      skipFormat: true,
    });

    const original = readProjectConfiguration(tree, "keep-uv-target");
    updateProjectConfiguration(tree, "keep-uv-target", {
      ...original,
      targets: {
        ...original.targets,
        uv: {
          executor: "nx:noop",
          options: {
            reason: "custom",
          },
        },
      },
    });

    await convertGenerator(tree, {
      project: "keep-uv-target",
      skipFormat: true,
    });

    const converted = readProjectConfiguration(tree, "keep-uv-target");

    expect(converted.targets?.uv).toEqual({
      executor: "nx:noop",
      options: {
        reason: "custom",
      },
    });
  });

  it("skips non-pyproject projects and respects project filters", async () => {
    await projectGenerator(tree, {
      name: "python-a",
      projectType: "lib",
      skipFormat: true,
    });
    await projectGenerator(tree, {
      name: "python-b",
      projectType: "lib",
      skipFormat: true,
    });

    const pythonBOriginal = readProjectConfiguration(tree, "python-b");
    const pythonBTargets = { ...(pythonBOriginal.targets ?? {}) };
    delete pythonBTargets.sync;
    updateProjectConfiguration(tree, "python-b", {
      ...pythonBOriginal,
      targets: pythonBTargets,
    });

    addProjectConfiguration(tree, "js-only", {
      root: "apps/js-only",
      sourceRoot: "apps/js-only/src",
      projectType: "application",
      targets: {
        lint: {
          executor: "nx:noop",
        },
      },
    });

    await convertGenerator(tree, {
      project: "python-a",
      skipFormat: true,
    });

    const pythonA = readProjectConfiguration(tree, "python-a");
    const pythonB = readProjectConfiguration(tree, "python-b");
    const jsOnly = readProjectConfiguration(tree, "js-only");

    expect(pythonA.targets?.sync).toBeDefined();
    expect(pythonB.targets?.sync).toBeUndefined();
    expect(jsOnly.targets).toEqual({
      lint: {
        executor: "nx:noop",
      },
    });
  });
});
