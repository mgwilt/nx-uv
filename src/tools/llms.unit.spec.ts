import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

import {
  checkLlms,
  collectLlmsEntries,
  createLlmsArtifacts,
  generateLlms,
  loadLlmsManifest,
  parseLlmsCliArgs,
  renderLlmsFullTxt,
  renderLlmsTxt,
  resolveLlmsPaths,
  runLlmsCheckCli,
  runLlmsGenerateCli,
  writeLlmsArtifacts,
  type LlmsManifest,
} from "./llms";

const tempRoots: string[] = [];

function createTempRoot(): string {
  const root = mkdtempSync(join(tmpdir(), "nx-uv-llms-"));
  tempRoots.push(root);
  return root;
}

function writeText(root: string, relativePath: string, content: string): void {
  const absolute = join(root, relativePath);
  mkdirSync(dirname(absolute), { recursive: true });
  writeFileSync(absolute, content, "utf-8");
}

function writeJson(root: string, relativePath: string, data: unknown): void {
  writeText(root, relativePath, `${JSON.stringify(data, null, 2)}\n`);
}

function createManifest(overrides?: Partial<LlmsManifest>): LlmsManifest {
  return {
    title: "@mgwilt/nx-uv",
    summary: "Nx plugin for uv workflows in Nx monorepos.",
    baseUrl: "https://github.com/mgwilt/nx-uv/blob/main",
    notes: ["Published as a pre-v1 beta package."],
    sections: [
      {
        name: "Docs",
        links: [
          {
            path: "README.md",
            label: "README",
            description: "Primary usage documentation.",
          },
          {
            path: "docs/index.md",
            label: "Docs Index",
            description: "Documentation entrypoint.",
          },
        ],
      },
      {
        name: "Maintainers",
        optional: true,
        links: [
          {
            path: "docs/maintainers.md",
            label: "Maintainer Guide",
            description: "Repository operations and release process.",
          },
        ],
      },
    ],
    ...overrides,
  };
}

afterEach(() => {
  while (tempRoots.length > 0) {
    const root = tempRoots.pop();
    if (root) {
      rmSync(root, { recursive: true, force: true });
    }
  }
});

describe("llms automation helpers", () => {
  it("loads manifest and validates required fields", () => {
    const root = createTempRoot();
    const manifest = createManifest();
    writeJson(root, "tools/llms-sources.json", manifest);

    const loaded = loadLlmsManifest(join(root, "tools/llms-sources.json"));
    expect(loaded.title).toBe(manifest.title);
    expect(loaded.sections).toHaveLength(2);
    expect(loaded.sections[1].optional).toBe(true);
  });

  it("throws for malformed manifest structures and entries", () => {
    const root = createTempRoot();
    const manifestPath = "tools/llms-sources.json";

    const cases: Array<{ value: unknown; message: string }> = [
      {
        value: null,
        message: "llms sources manifest must be a JSON object.",
      },
      {
        value: { summary: "ok", baseUrl: "https://example.com", sections: [] },
        message: "llms sources manifest requires a non-empty title.",
      },
      {
        value: { title: "ok", baseUrl: "https://example.com", sections: [] },
        message: "llms sources manifest requires a non-empty summary.",
      },
      {
        value: { title: "ok", summary: "ok", sections: [] },
        message: "llms sources manifest requires a non-empty baseUrl.",
      },
      {
        value: {
          title: "ok",
          summary: "ok",
          baseUrl: "https://x",
          notes: "not-an-array",
          sections: [
            {
              name: "Docs",
              links: [{ path: "README.md", label: "R", description: "D" }],
            },
          ],
        },
        message: "llms sources manifest notes must be an array of strings.",
      },
      {
        value: {
          title: "ok",
          summary: "ok",
          baseUrl: "https://x",
          sections: [],
        },
        message: "llms sources manifest requires at least one section.",
      },
      {
        value: {
          title: "ok",
          summary: "ok",
          baseUrl: "https://x",
          notes: [1],
          sections: [
            {
              name: "Docs",
              links: [{ path: "README.md", label: "R", description: "D" }],
            },
          ],
        },
        message: "llms sources manifest notes must be an array of strings.",
      },
      {
        value: {
          title: "ok",
          summary: "ok",
          baseUrl: "https://x",
          sections: [1],
        },
        message: "Section at index 0 must be an object.",
      },
      {
        value: {
          title: "ok",
          summary: "ok",
          baseUrl: "https://x",
          sections: [
            {
              name: "",
              links: [{ path: "README.md", label: "R", description: "D" }],
            },
          ],
        },
        message: "Section at index 0 requires a non-empty name.",
      },
      {
        value: {
          title: "ok",
          summary: "ok",
          baseUrl: "https://x",
          sections: [
            {
              name: "Docs",
              optional: "yes",
              links: [{ path: "README.md", label: "R", description: "D" }],
            },
          ],
        },
        message: 'Section "Docs" optional must be a boolean when provided.',
      },
      {
        value: {
          title: "ok",
          summary: "ok",
          baseUrl: "https://x",
          sections: [{ name: "Docs", links: [] }],
        },
        message: 'Section "Docs" must define at least one link entry.',
      },
      {
        value: {
          title: "ok",
          summary: "ok",
          baseUrl: "https://x",
          sections: [{ name: "Docs", links: [1] }],
        },
        message: 'Link at index 0 in section "Docs" must be an object.',
      },
      {
        value: {
          title: "ok",
          summary: "ok",
          baseUrl: "https://x",
          sections: [
            { name: "Docs", links: [{ label: "R", description: "D" }] },
          ],
        },
        message: 'Link at index 0 in section "Docs" requires a non-empty path.',
      },
      {
        value: {
          title: "ok",
          summary: "ok",
          baseUrl: "https://x",
          sections: [
            { name: "Docs", links: [{ path: "README.md", description: "D" }] },
          ],
        },
        message:
          'Link at index 0 in section "Docs" requires a non-empty label.',
      },
      {
        value: {
          title: "ok",
          summary: "ok",
          baseUrl: "https://x",
          sections: [
            { name: "Docs", links: [{ path: "README.md", label: "R" }] },
          ],
        },
        message:
          'Link at index 0 in section "Docs" requires a non-empty description.',
      },
    ];

    for (const testCase of cases) {
      writeJson(root, manifestPath, testCase.value);
      expect(() => loadLlmsManifest(join(root, manifestPath))).toThrow(
        testCase.message,
      );
    }
  });

  it("collects entries and rejects duplicate paths", () => {
    const root = createTempRoot();
    writeText(root, "README.md", "# README\n");
    writeText(root, "docs/index.md", "# Docs\n");
    writeText(root, "docs/maintainers.md", "# Maintainers\n");

    const manifest = createManifest();
    const entries = collectLlmsEntries(root, manifest);
    expect(entries).toHaveLength(3);
    expect(entries[0].url).toBe(
      "https://github.com/mgwilt/nx-uv/blob/main/README.md",
    );

    const duplicate = createManifest({
      sections: [
        {
          name: "Docs",
          links: [
            {
              path: "README.md",
              label: "README",
              description: "Primary usage documentation.",
            },
            {
              path: "README.md",
              label: "README duplicate",
              description: "Duplicate path entry.",
            },
          ],
        },
      ],
    });

    expect(() => collectLlmsEntries(root, duplicate)).toThrow(
      "Duplicate llms source path: README.md",
    );

    expect(() =>
      collectLlmsEntries(
        root,
        createManifest({
          sections: [
            {
              name: "Docs",
              links: [
                {
                  path: "missing.md",
                  label: "Missing",
                  description: "Missing file.",
                },
              ],
            },
          ],
        }),
      ),
    ).toThrow("llms source file does not exist: missing.md");
  });

  it("renders llms.txt with required heading, summary, sections, and optional links", () => {
    const root = createTempRoot();
    writeText(root, "README.md", "# README\n");
    writeText(root, "docs/index.md", "# Docs\n");
    writeText(root, "docs/maintainers.md", "# Maintainers\n");

    const manifest = createManifest();
    const entries = collectLlmsEntries(root, manifest);
    const output = renderLlmsTxt(manifest, entries);

    expect(output).toContain("# @mgwilt/nx-uv");
    expect(output).toContain("> Nx plugin for uv workflows in Nx monorepos.");
    expect(output).toContain("## Docs");
    expect(output).toContain("## Optional");
    expect(output).toContain(
      "- [Maintainer Guide](https://github.com/mgwilt/nx-uv/blob/main/docs/maintainers.md): Repository operations and release process. [Maintainers]",
    );
  });

  it("renders llms-full.txt with inline source content", () => {
    const root = createTempRoot();
    writeText(root, "README.md", "# README\n\nProject docs.\n");
    writeText(root, "docs/index.md", "# Docs\n\nIndex page.\n");
    writeText(root, "docs/maintainers.md", "# Maintainers\n\nOps.\n");

    const manifest = createManifest();
    const entries = collectLlmsEntries(root, manifest);
    const output = renderLlmsFullTxt(manifest, entries);

    expect(output).toContain(
      "This file is generated by `tools/generate-llms.cjs`.",
    );
    expect(output).toContain("## Docs");
    expect(output).toContain("### README");
    expect(output).toContain(
      "Source: https://github.com/mgwilt/nx-uv/blob/main/README.md",
    );
    expect(output).toContain("# README");
    expect(output).toContain("## Maintainers (Optional)");
  });

  it("handles optional suffix and skips sections with no rendered entries", () => {
    const root = createTempRoot();
    writeText(root, "README.md", "# README\n");
    writeText(root, "docs/index.md", "# Docs\n");
    writeText(root, "docs/empty-section.md", "# Empty\n");
    writeText(root, "docs/optional.md", "# Optional\n");

    const manifest = createManifest({
      notes: undefined,
      sections: [
        {
          name: "Docs",
          links: [
            {
              path: "README.md",
              label: "README",
              description: "Primary usage documentation.",
            },
            {
              path: "docs/index.md",
              label: "Docs Index",
              description: "Documentation entrypoint.",
            },
          ],
        },
        {
          name: "Empty Section",
          links: [
            {
              path: "docs/empty-section.md",
              label: "Duplicate for filtering",
              description: "Used to verify section skip behavior.",
            },
          ],
        },
        {
          name: "Optional",
          optional: true,
          links: [
            {
              path: "docs/optional.md",
              label: "Optional Docs Index",
              description: "Optional docs entry.",
            },
          ],
        },
      ],
    });
    const entries = collectLlmsEntries(root, manifest);
    const filteredEntries = entries.filter(
      (entry) => entry.section !== "Empty Section",
    );
    const llmsTxt = renderLlmsTxt(manifest, filteredEntries);
    const llmsFull = renderLlmsFullTxt(manifest, filteredEntries);

    expect(llmsTxt).toContain("## Optional");
    expect(llmsTxt).toContain(
      "- [Optional Docs Index](https://github.com/mgwilt/nx-uv/blob/main/docs/optional.md): Optional docs entry.",
    );
    expect(llmsTxt).not.toContain("## Empty Section");
    expect(llmsTxt).not.toContain("[Optional]");
    expect(llmsFull).not.toContain("Important notes:");
    expect(llmsFull).not.toContain("## Empty Section");
  });

  it("writes generated artifacts and detects drift", () => {
    const root = createTempRoot();
    writeText(root, "README.md", "# README\n");
    writeText(root, "docs/index.md", "# Docs\n");
    writeText(root, "docs/maintainers.md", "# Maintainers\n");
    writeJson(root, "tools/llms-sources.json", createManifest());

    const paths = resolveLlmsPaths({
      repoRoot: root,
      manifestPath: "tools/llms-sources.json",
      llmsPath: "llms.txt",
      llmsFullPath: "llms-full.txt",
    });
    const artifacts = createLlmsArtifacts(paths);
    writeLlmsArtifacts(paths, artifacts);

    const clean = checkLlms(paths);
    expect(clean.ok).toBe(true);
    expect(clean.driftedFiles).toHaveLength(0);

    writeText(root, "llms.txt", "stale\n");
    const drifted = checkLlms(paths);
    expect(drifted.ok).toBe(false);
    expect(drifted.driftedFiles).toContain(paths.llmsPath);

    const onDisk = readFileSync(join(root, "llms-full.txt"), "utf-8");
    expect(onDisk).toContain("### Maintainer Guide");
  });

  it("generates artifacts via helpers and cli wrappers", () => {
    const root = createTempRoot();
    writeText(root, "README.md", "# README\n");
    writeText(root, "docs/index.md", "# Docs\n");
    writeText(root, "docs/maintainers.md", "# Maintainers\n");
    writeJson(root, "tools/llms-sources.json", createManifest());

    const stdoutSpy = vi
      .spyOn(process.stdout, "write")
      .mockImplementation(() => true);
    const stderrSpy = vi
      .spyOn(process.stderr, "write")
      .mockImplementation(() => true);

    try {
      const paths = resolveLlmsPaths({
        repoRoot: root,
        manifestPath: "tools/llms-sources.json",
        llmsPath: "llms.txt",
        llmsFullPath: "llms-full.txt",
      });

      generateLlms(paths);
      expect(readFileSync(join(root, "llms.txt"), "utf-8")).toContain(
        "## Docs",
      );
      expect(readFileSync(join(root, "llms-full.txt"), "utf-8")).toContain(
        "### Maintainer Guide",
      );

      runLlmsGenerateCli([
        "--repo-root",
        root,
        "--manifest",
        "tools/llms-sources.json",
      ]);

      expect(runLlmsCheckCli(["--repo-root", root]).ok).toBe(true);

      writeText(root, "llms.txt", "stale\n");
      const stale = runLlmsCheckCli(["--repo-root", root]);
      expect(stale.ok).toBe(false);
      expect(stale.driftedFiles).toContain(join(root, "llms.txt"));
    } finally {
      stdoutSpy.mockRestore();
      stderrSpy.mockRestore();
    }
  });

  it("flags missing llms outputs as drift", () => {
    const root = createTempRoot();
    writeText(root, "README.md", "# README\n");
    writeText(root, "docs/index.md", "# Docs\n");
    writeText(root, "docs/maintainers.md", "# Maintainers\n");
    writeJson(root, "tools/llms-sources.json", createManifest());

    const paths = resolveLlmsPaths({
      repoRoot: root,
      manifestPath: "tools/llms-sources.json",
      llmsPath: "llms.txt",
      llmsFullPath: "llms-full.txt",
    });
    const missing = checkLlms(paths);

    expect(missing.ok).toBe(false);
    expect(missing.driftedFiles).toContain(paths.llmsPath);
    expect(missing.driftedFiles).toContain(paths.llmsFullPath);
  });

  it("parses cli args with defaults and explicit overrides", () => {
    expect(parseLlmsCliArgs([])).toEqual({
      repoRoot: ".",
      manifestPath: "tools/llms-sources.json",
      llmsPath: "llms.txt",
      llmsFullPath: "llms-full.txt",
    });

    expect(
      parseLlmsCliArgs([
        "--repo-root",
        "tmp/repo",
        "--manifest",
        "config/llms.json",
        "--llms-output",
        "out/llms.txt",
        "--llms-full-output",
        "out/llms-full.txt",
      ]),
    ).toEqual({
      repoRoot: "tmp/repo",
      manifestPath: "config/llms.json",
      llmsPath: "out/llms.txt",
      llmsFullPath: "out/llms-full.txt",
    });
  });

  it("throws for unknown or malformed cli args", () => {
    expect(() => parseLlmsCliArgs(["--invalid"])).toThrow(
      "Unknown argument: --invalid",
    );
    expect(() => parseLlmsCliArgs(["--manifest"])).toThrow(
      "Missing value for --manifest",
    );
    expect(() => parseLlmsCliArgs(["--repo-root"])).toThrow(
      "Missing value for --repo-root",
    );
    expect(() => parseLlmsCliArgs(["--llms-output"])).toThrow(
      "Missing value for --llms-output",
    );
    expect(() => parseLlmsCliArgs(["--llms-full-output"])).toThrow(
      "Missing value for --llms-full-output",
    );
  });
});
