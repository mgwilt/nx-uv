import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

const generateSamples = require("../../tools/generate-samples.cjs") as {
  applyTreeToFs: (
    tree: {
      listChanges: () => Array<{
        type: string;
        path: string;
        content: unknown;
      }>;
    },
    outputDir: string,
  ) => void;
  customizePackageJson: (
    tree: {
      read: (path: string, encoding: string) => string;
      write: (path: string, content: string) => void;
    },
    sample: { workspaceDir: string },
  ) => void;
  ensureDir: (targetDir: string) => void;
  generateSample: (
    outputDir: string,
    sample: {
      title: string;
      workspaceDir: string;
      workspaceName: string;
      project: { name: string; projectType: string; directory: string };
      integrations: string[];
      dependencyCommands: string[];
      runTargets: string[];
    },
    generatorDependencies: {
      createTreeWithEmptyWorkspace: () => {
        read: (path: string, encoding: string) => string;
        write: (path: string, content: string) => void;
        listChanges: () => Array<{
          type: string;
          path: string;
          content: unknown;
        }>;
      };
      workspaceGenerator: (tree: unknown, options: unknown) => Promise<void>;
      projectGenerator: (tree: unknown, options: unknown) => Promise<void>;
      integrationGenerator: (tree: unknown, options: unknown) => Promise<void>;
    },
  ) => Promise<void>;
  main: (options?: {
    samplesRoot?: string;
    sampleDefinitions?: Array<
      { slug: string; summary: string } & Record<string, unknown>
    >;
    fileSystem?: unknown;
    pathModule?: unknown;
    writeStdout?: (value: string) => void;
    generateSampleImpl?: (
      outputDir: string,
      sample: Record<string, unknown>,
      generatorDependencies?: unknown,
      fileSystem?: unknown,
      pathModule?: unknown,
    ) => Promise<void>;
    renderSamplesIndexImpl?: (items: unknown[]) => string;
  }) => Promise<void>;
  removeManagedSamples: (
    samplesRoot: string,
    sampleDefinitions: Array<{ slug: string }>,
  ) => void;
  renderSampleReadme: (
    sample: {
      title: string;
      workspaceDir: string;
      workspaceName: string;
      project: { name: string; projectType: string; directory: string };
      integrations: string[];
      dependencyCommands: string[];
      runTargets: string[];
    },
    workspaceTemplates?: Set<string>,
  ) => string;
  renderSamplesIndex: (
    items: Array<{ slug: string; summary: string }>,
  ) => string;
  resolveGeneratorDependencies: () => {
    createTreeWithEmptyWorkspace: unknown;
    workspaceGenerator: unknown;
    projectGenerator: unknown;
    integrationGenerator: unknown;
  };
  runGenerateSamplesCli: (runner?: () => Promise<void>) => Promise<boolean>;
  writeFile: (filePath: string, content: string) => void;
};

const tempRoots: string[] = [];

function createTempRoot(): string {
  const root = mkdtempSync(join(tmpdir(), "nx-uv-generate-samples-"));
  tempRoots.push(root);
  return root;
}

function createSample(overrides: Partial<ReturnType<typeof baseSample>> = {}) {
  return {
    ...baseSample(),
    ...overrides,
  };
}

function baseSample() {
  return {
    slug: "sample-a",
    title: "Sample A",
    summary: "summary a",
    workspaceDir: "acme",
    workspaceName: "acme",
    project: {
      name: "api",
      projectType: "app",
      directory: "packages/py",
    },
    integrations: ["github", "fastapi"],
    dependencyCommands: ["uv add fastapi"],
    runTargets: ["pnpm nx run api:test"],
  };
}

afterEach(() => {
  while (tempRoots.length > 0) {
    const root = tempRoots.pop();
    if (root) {
      rmSync(root, { recursive: true, force: true });
    }
  }
  vi.restoreAllMocks();
  process.exitCode = undefined;
});

describe("generate-samples cli script helpers", () => {
  it("renders sample readme commands for workspace and project-level integrations", () => {
    const readme = generateSamples.renderSampleReadme(
      createSample(),
      new Set(["github"]),
    );

    expect(readme).toContain(
      "pnpm nx g @mgwilt/nx-uv:integration --template=github",
    );
    expect(readme).toContain(
      "pnpm nx g @mgwilt/nx-uv:integration --template=fastapi --project=api",
    );
  });

  it("renders samples index from passed definitions", () => {
    const index = generateSamples.renderSamplesIndex([
      { slug: "first", summary: "one" },
      { slug: "second", summary: "two" },
    ]);

    expect(index).toContain("[`first`](first/README.md)");
    expect(index).toContain("  - two");
  });

  it("writes files with normalized newlines and parent directory creation", () => {
    const root = createTempRoot();
    const filePath = join(root, "nested", "file.txt");

    generateSamples.writeFile(filePath, "line-1\r\nline-2\r\n");

    expect(readFileSync(filePath, "utf-8")).toBe("line-1\nline-2\n");
  });

  it("removes managed sample directories only", () => {
    const root = createTempRoot();
    const managed = join(root, "managed");
    const keep = join(root, "keep");
    mkdirSync(managed, { recursive: true });
    mkdirSync(keep, { recursive: true });
    writeFileSync(join(managed, "README.md"), "remove me\n", "utf-8");
    writeFileSync(join(keep, "README.md"), "keep me\n", "utf-8");

    generateSamples.removeManagedSamples(root, [{ slug: "managed" }]);

    expect(existsSync(managed)).toBe(false);
    expect(existsSync(keep)).toBe(true);
  });

  it("applies tree changes to filesystem for create, update, and delete paths", () => {
    const root = createTempRoot();
    const deletePath = join(root, "to-delete.txt");
    writeFileSync(deletePath, "remove\n", "utf-8");

    generateSamples.applyTreeToFs(
      {
        listChanges: () => [
          { type: "DELETE", path: "to-delete.txt", content: "" },
          { type: "CREATE", path: "dir/from-string.txt", content: "text" },
          {
            type: "UPDATE",
            path: "dir/from-buffer.txt",
            content: Buffer.from("buffer"),
          },
        ],
      },
      root,
    );

    expect(existsSync(deletePath)).toBe(false);
    expect(readFileSync(join(root, "dir", "from-string.txt"), "utf-8")).toBe(
      "text",
    );
    expect(readFileSync(join(root, "dir", "from-buffer.txt"), "utf-8")).toBe(
      "buffer",
    );
  });

  it("customizes package.json for generated samples", () => {
    const files = new Map<string, string>([
      [
        "package.json",
        JSON.stringify({
          name: "before",
          private: false,
          devDependencies: { existing: "1.0.0" },
        }),
      ],
    ]);
    const tree = {
      read: (filePath: string) => files.get(filePath) ?? "",
      write: (filePath: string, content: string) =>
        files.set(filePath, content),
    };

    generateSamples.customizePackageJson(tree, {
      workspaceDir: "acme-workspace",
    });

    const written = JSON.parse(files.get("package.json") ?? "{}") as {
      name: string;
      private: boolean;
      packageManager: string;
      devDependencies: Record<string, string>;
    };
    expect(written.name).toBe("acme-workspace");
    expect(written.private).toBe(true);
    expect(written.packageManager).toBe("pnpm@10");
    expect(written.devDependencies).toMatchObject({
      existing: "1.0.0",
      "@mgwilt/nx-uv": "beta",
      nx: "22.5.3",
    });
  });

  it("generates a sample using injected generator dependencies", async () => {
    const root = createTempRoot();
    const calls: Array<{ type: string; options: unknown }> = [];
    const files = new Map<string, string>([
      [
        "package.json",
        JSON.stringify({
          name: "before",
          devDependencies: {},
        }),
      ],
      ["packages/py/api/main.py", "print('hello')\n"],
    ]);
    const tree = {
      read: (filePath: string) => files.get(filePath) ?? "",
      write: (filePath: string, content: string) => {
        files.set(filePath, content);
      },
      listChanges: () =>
        Array.from(files.entries()).map(([filePath, content]) => ({
          type: "CREATE",
          path: filePath,
          content,
        })),
    };
    const sample = createSample();
    const deps = {
      createTreeWithEmptyWorkspace: () => tree,
      workspaceGenerator: vi.fn(async (_tree: unknown, options: unknown) => {
        calls.push({ type: "workspace", options });
      }),
      projectGenerator: vi.fn(async (_tree: unknown, options: unknown) => {
        calls.push({ type: "project", options });
      }),
      integrationGenerator: vi.fn(async (_tree: unknown, options: unknown) => {
        calls.push({ type: "integration", options });
      }),
    };

    await generateSamples.generateSample(join(root, sample.slug), sample, deps);

    expect(calls[0]).toEqual({
      type: "workspace",
      options: { name: "acme", membersGlob: "packages/py/*" },
    });
    expect(calls[1]).toEqual({
      type: "project",
      options: {
        name: "api",
        projectType: "app",
        directory: "packages/py",
      },
    });
    expect(calls[2]).toEqual({
      type: "integration",
      options: { template: "github" },
    });
    expect(calls[3]).toEqual({
      type: "integration",
      options: { template: "fastapi", project: "api" },
    });
    expect(
      readFileSync(join(root, sample.slug, "README.md"), "utf-8"),
    ).toContain("# Sample A");
    expect(
      JSON.parse(
        readFileSync(join(root, sample.slug, "package.json"), "utf-8"),
      ),
    ).toMatchObject({
      name: "acme",
      packageManager: "pnpm@10",
    });
  });

  it("runs main with injected operations and writes summary output", async () => {
    const root = createTempRoot();
    const calls: Array<{
      outputDir: string;
      fileSystem: unknown;
      pathModule: unknown;
    }> = [];
    const logs: string[] = [];
    const samples = [
      createSample({ slug: "one" }),
      createSample({ slug: "two" }),
    ];
    const fileSystemProxy = {
      mkdirSync,
      rmSync,
      writeFileSync,
    };
    const pathModuleProxy = {
      join,
      dirname,
    };

    await generateSamples.main({
      samplesRoot: root,
      sampleDefinitions: samples,
      fileSystem: fileSystemProxy,
      pathModule: pathModuleProxy,
      generateSampleImpl: async (
        outputDir: string,
        _sample: Record<string, unknown>,
        _generatorDependencies: unknown,
        fileSystem: unknown,
        pathModule: unknown,
      ) => {
        calls.push({ outputDir, fileSystem, pathModule });
      },
      renderSamplesIndexImpl: (items: unknown[]) => `index=${items.length}`,
      writeStdout: (value: string) => {
        logs.push(value);
      },
    });

    expect(calls).toEqual([
      {
        outputDir: join(root, "one"),
        fileSystem: fileSystemProxy,
        pathModule: pathModuleProxy,
      },
      {
        outputDir: join(root, "two"),
        fileSystem: fileSystemProxy,
        pathModule: pathModuleProxy,
      },
    ]);
    expect(readFileSync(join(root, "README.md"), "utf-8")).toBe("index=2");
    expect(logs).toEqual([`Generated 2 samples in ${root}.\n`]);
  });

  it("handles success and failure for runGenerateSamplesCli", async () => {
    const stderrSpy = vi
      .spyOn(process.stderr, "write")
      .mockImplementation(() => true);

    const success = await generateSamples.runGenerateSamplesCli(async () =>
      Promise.resolve(),
    );
    expect(success).toBe(true);
    expect(process.exitCode).toBeUndefined();

    const failure = await generateSamples.runGenerateSamplesCli(async () => {
      throw new Error("generate failed");
    });
    expect(failure).toBe(false);
    expect(stderrSpy).toHaveBeenCalledTimes(1);
    expect(String(stderrSpy.mock.calls[0]?.[0])).toContain("generate failed");
    expect(process.exitCode).toBe(1);
  });

  it("creates directories with ensureDir helper", () => {
    const root = createTempRoot();
    const target = join(root, "a", "b", "c");

    generateSamples.ensureDir(target);

    expect(existsSync(target)).toBe(true);
  });
});
