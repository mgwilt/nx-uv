import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

export interface LlmsLinkSource {
  path: string;
  label: string;
  description: string;
}

export interface LlmsSectionSource {
  name: string;
  optional?: boolean;
  links: LlmsLinkSource[];
}

export interface LlmsManifest {
  title: string;
  summary: string;
  baseUrl: string;
  notes?: string[];
  sections: LlmsSectionSource[];
}

export interface LlmsEntry {
  section: string;
  optional: boolean;
  path: string;
  label: string;
  description: string;
  sourcePath: string;
  url: string;
  content: string;
}

export interface LlmsPaths {
  repoRoot: string;
  manifestPath: string;
  llmsPath: string;
  llmsFullPath: string;
}

export interface LlmsArtifacts {
  llms: string;
  llmsFull: string;
}

export interface LlmsCheckResult {
  ok: boolean;
  driftedFiles: string[];
}

export interface LlmsCliOptions {
  repoRoot: string;
  manifestPath: string;
  llmsPath: string;
  llmsFullPath: string;
}

const DEFAULT_REPO_ROOT = ".";
const DEFAULT_MANIFEST_PATH = "tools/llms-sources.json";
const DEFAULT_LLMS_PATH = "llms.txt";
const DEFAULT_LLMS_FULL_PATH = "llms-full.txt";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function normalizeNewlines(value: string): string {
  return value.replace(/\r\n/g, "\n");
}

function withTrailingNewline(value: string): string {
  return value.endsWith("\n") ? value : `${value}\n`;
}

function toPosixPath(filePath: string): string {
  return filePath.replace(/\\/g, "/").replace(/^\.\//, "");
}

function joinUrl(baseUrl: string, relativePath: string): string {
  const normalizedBase = baseUrl.replace(/\/+$/, "");
  const normalizedPath = toPosixPath(relativePath).replace(/^\/+/, "");
  return `${normalizedBase}/${normalizedPath}`;
}

export function loadLlmsManifest(manifestPath: string): LlmsManifest {
  const raw = readFileSync(manifestPath, "utf-8");
  const parsed: unknown = JSON.parse(raw);

  if (!isRecord(parsed)) {
    throw new Error("llms sources manifest must be a JSON object.");
  }

  if (typeof parsed.title !== "string" || parsed.title.trim().length === 0) {
    throw new Error("llms sources manifest requires a non-empty title.");
  }

  if (
    typeof parsed.summary !== "string" ||
    parsed.summary.trim().length === 0
  ) {
    throw new Error("llms sources manifest requires a non-empty summary.");
  }

  if (
    typeof parsed.baseUrl !== "string" ||
    parsed.baseUrl.trim().length === 0
  ) {
    throw new Error("llms sources manifest requires a non-empty baseUrl.");
  }

  if (!Array.isArray(parsed.sections) || parsed.sections.length === 0) {
    throw new Error("llms sources manifest requires at least one section.");
  }

  const notes =
    parsed.notes === undefined
      ? undefined
      : Array.isArray(parsed.notes)
        ? parsed.notes
        : null;

  if (
    notes === null ||
    (notes !== undefined && notes.some((note) => typeof note !== "string"))
  ) {
    throw new Error("llms sources manifest notes must be an array of strings.");
  }

  const sections: LlmsSectionSource[] = parsed.sections.map(
    (section, index) => {
      if (!isRecord(section)) {
        throw new Error(`Section at index ${index} must be an object.`);
      }

      if (
        typeof section.name !== "string" ||
        section.name.trim().length === 0
      ) {
        throw new Error(`Section at index ${index} requires a non-empty name.`);
      }

      if (!Array.isArray(section.links) || section.links.length === 0) {
        throw new Error(
          `Section "${section.name}" must define at least one link entry.`,
        );
      }

      if (
        section.optional !== undefined &&
        typeof section.optional !== "boolean"
      ) {
        throw new Error(
          `Section "${section.name}" optional must be a boolean when provided.`,
        );
      }

      const links = section.links.map((link, linkIndex) => {
        if (!isRecord(link)) {
          throw new Error(
            `Link at index ${linkIndex} in section "${section.name}" must be an object.`,
          );
        }

        if (typeof link.path !== "string" || link.path.trim().length === 0) {
          throw new Error(
            `Link at index ${linkIndex} in section "${section.name}" requires a non-empty path.`,
          );
        }

        if (typeof link.label !== "string" || link.label.trim().length === 0) {
          throw new Error(
            `Link at index ${linkIndex} in section "${section.name}" requires a non-empty label.`,
          );
        }

        if (
          typeof link.description !== "string" ||
          link.description.trim().length === 0
        ) {
          throw new Error(
            `Link at index ${linkIndex} in section "${section.name}" requires a non-empty description.`,
          );
        }

        return {
          path: link.path,
          label: link.label,
          description: link.description,
        };
      });

      return {
        name: section.name,
        optional: section.optional ?? false,
        links,
      };
    },
  );

  return {
    title: parsed.title,
    summary: parsed.summary,
    baseUrl: parsed.baseUrl,
    notes,
    sections,
  };
}

export function collectLlmsEntries(
  repoRoot: string,
  manifest: LlmsManifest,
): LlmsEntry[] {
  const seenPaths = new Set<string>();
  const entries: LlmsEntry[] = [];

  for (const section of manifest.sections) {
    for (const link of section.links) {
      const relativePath = toPosixPath(link.path);
      if (seenPaths.has(relativePath)) {
        throw new Error(`Duplicate llms source path: ${relativePath}`);
      }
      seenPaths.add(relativePath);

      const sourcePath = resolve(repoRoot, relativePath);
      if (!existsSync(sourcePath)) {
        throw new Error(`llms source file does not exist: ${relativePath}`);
      }

      const content = normalizeNewlines(readFileSync(sourcePath, "utf-8"));
      entries.push({
        section: section.name,
        optional: section.optional ?? false,
        path: relativePath,
        label: link.label,
        description: link.description,
        sourcePath,
        url: joinUrl(manifest.baseUrl, relativePath),
        content,
      });
    }
  }

  return entries;
}

export function renderLlmsTxt(
  manifest: LlmsManifest,
  entries: LlmsEntry[],
): string {
  const lines: string[] = [`# ${manifest.title}`, "", `> ${manifest.summary}`];

  if ((manifest.notes?.length ?? 0) > 0) {
    lines.push("", "Important notes:", "");
    for (const note of manifest.notes ?? []) {
      lines.push(`- ${note}`);
    }
  }

  for (const section of manifest.sections.filter((item) => !item.optional)) {
    const sectionEntries = entries.filter(
      (entry) => !entry.optional && entry.section === section.name,
    );
    if (sectionEntries.length === 0) {
      continue;
    }

    lines.push("", `## ${section.name}`, "");
    for (const entry of sectionEntries) {
      lines.push(`- [${entry.label}](${entry.url}): ${entry.description}`);
    }
  }

  const optionalEntries = entries.filter((entry) => entry.optional);
  if (optionalEntries.length > 0) {
    lines.push("", "## Optional", "");

    for (const entry of optionalEntries) {
      const sectionSuffix =
        entry.section.toLowerCase() === "optional" ? "" : ` [${entry.section}]`;
      lines.push(
        `- [${entry.label}](${entry.url}): ${entry.description}${sectionSuffix}`,
      );
    }
  }

  return withTrailingNewline(lines.join("\n"));
}

export function renderLlmsFullTxt(
  manifest: LlmsManifest,
  entries: LlmsEntry[],
): string {
  const lines: string[] = [
    `# ${manifest.title}`,
    "",
    `> ${manifest.summary}`,
    "",
    "This file is generated by `tools/generate-llms.cjs`.",
  ];

  if ((manifest.notes?.length ?? 0) > 0) {
    lines.push("", "Important notes:", "");
    for (const note of manifest.notes ?? []) {
      lines.push(`- ${note}`);
    }
  }

  for (const section of manifest.sections) {
    const sectionEntries = entries.filter(
      (entry) => entry.section === section.name,
    );
    if (sectionEntries.length === 0) {
      continue;
    }

    lines.push(
      "",
      `## ${section.name}${section.optional ? " (Optional)" : ""}`,
    );

    for (const entry of sectionEntries) {
      lines.push("", `### ${entry.label}`, "", `Source: ${entry.url}`, "");
      lines.push(entry.content.trimEnd());
    }
  }

  return withTrailingNewline(lines.join("\n"));
}

export function resolveLlmsPaths(options: LlmsCliOptions): LlmsPaths {
  const repoRoot = resolve(options.repoRoot);
  return {
    repoRoot,
    manifestPath: resolve(repoRoot, options.manifestPath),
    llmsPath: resolve(repoRoot, options.llmsPath),
    llmsFullPath: resolve(repoRoot, options.llmsFullPath),
  };
}

export function createLlmsArtifacts(paths: LlmsPaths): LlmsArtifacts {
  const manifest = loadLlmsManifest(paths.manifestPath);
  const entries = collectLlmsEntries(paths.repoRoot, manifest);

  return {
    llms: renderLlmsTxt(manifest, entries),
    llmsFull: renderLlmsFullTxt(manifest, entries),
  };
}

export function writeLlmsArtifacts(
  paths: Pick<LlmsPaths, "llmsPath" | "llmsFullPath">,
  artifacts: LlmsArtifacts,
): void {
  mkdirSync(dirname(paths.llmsPath), { recursive: true });
  mkdirSync(dirname(paths.llmsFullPath), { recursive: true });
  writeFileSync(paths.llmsPath, artifacts.llms, "utf-8");
  writeFileSync(paths.llmsFullPath, artifacts.llmsFull, "utf-8");
}

export function generateLlms(paths: LlmsPaths): LlmsArtifacts {
  const artifacts = createLlmsArtifacts(paths);
  writeLlmsArtifacts(paths, artifacts);
  return artifacts;
}

export function checkLlms(paths: LlmsPaths): LlmsCheckResult {
  const artifacts = createLlmsArtifacts(paths);
  const driftedFiles: string[] = [];

  const checks: Array<[string, string]> = [
    [paths.llmsPath, artifacts.llms],
    [paths.llmsFullPath, artifacts.llmsFull],
  ];

  for (const [filePath, expected] of checks) {
    if (!existsSync(filePath)) {
      driftedFiles.push(filePath);
      continue;
    }

    const current = normalizeNewlines(readFileSync(filePath, "utf-8"));
    if (current !== expected) {
      driftedFiles.push(filePath);
    }
  }

  return {
    ok: driftedFiles.length === 0,
    driftedFiles,
  };
}

export function parseLlmsCliArgs(args: string[]): LlmsCliOptions {
  let repoRoot = DEFAULT_REPO_ROOT;
  let manifestPath = DEFAULT_MANIFEST_PATH;
  let llmsPath = DEFAULT_LLMS_PATH;
  let llmsFullPath = DEFAULT_LLMS_FULL_PATH;

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    const next = args[index + 1];

    if (arg === "--repo-root") {
      if (!next) {
        throw new Error("Missing value for --repo-root");
      }
      repoRoot = next;
      index += 1;
      continue;
    }

    if (arg === "--manifest") {
      if (!next) {
        throw new Error("Missing value for --manifest");
      }
      manifestPath = next;
      index += 1;
      continue;
    }

    if (arg === "--llms-output") {
      if (!next) {
        throw new Error("Missing value for --llms-output");
      }
      llmsPath = next;
      index += 1;
      continue;
    }

    if (arg === "--llms-full-output") {
      if (!next) {
        throw new Error("Missing value for --llms-full-output");
      }
      llmsFullPath = next;
      index += 1;
      continue;
    }

    throw new Error(`Unknown argument: ${arg}`);
  }

  return {
    repoRoot,
    manifestPath,
    llmsPath,
    llmsFullPath,
  };
}

export function runLlmsGenerateCli(args: string[]): LlmsArtifacts {
  const options = parseLlmsCliArgs(args);
  const paths = resolveLlmsPaths(options);
  const artifacts = generateLlms(paths);

  process.stdout.write(
    `Generated ${toPosixPath(paths.llmsPath)} and ${toPosixPath(
      paths.llmsFullPath,
    )}.\n`,
  );

  return artifacts;
}

export function runLlmsCheckCli(args: string[]): LlmsCheckResult {
  const options = parseLlmsCliArgs(args);
  const paths = resolveLlmsPaths(options);
  const result = checkLlms(paths);

  if (!result.ok) {
    process.stderr.write(
      "llms artifacts are out of date. Run `pnpm llms:generate` and commit the results.\n",
    );
    for (const drifted of result.driftedFiles) {
      process.stderr.write(`- ${toPosixPath(drifted)}\n`);
    }
    return result;
  }

  process.stdout.write("llms artifacts are up to date.\n");
  return result;
}
