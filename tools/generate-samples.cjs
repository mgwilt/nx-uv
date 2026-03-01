#!/usr/bin/env node
"use strict";

require("@swc-node/register");

const fs = require("node:fs");
const path = require("node:path");
const { createTreeWithEmptyWorkspace } = require("@nx/devkit/testing");
const {
  workspaceGenerator,
} = require("../src/generators/workspace/workspace.ts");
const { projectGenerator } = require("../src/generators/project/project.ts");
const {
  integrationGenerator,
} = require("../src/generators/integration/integration.ts");

const REPO_ROOT = path.resolve(__dirname, "..");
const SAMPLES_ROOT = path.join(REPO_ROOT, "samples");
const WORKSPACE_LEVEL_TEMPLATES = new Set([
  "github",
  "gitlab",
  "dependency-bots",
  "pre-commit",
]);

const SAMPLE_DEFINITIONS = [
  {
    slug: "01-brand-new-fastapi-github",
    title:
      "01 Brand New [FastAPI](https://fastapi.tiangolo.com/) + [GitHub Actions](https://github.com/features/actions)",
    summary: "Mirrors the brand-new monorepo walkthrough from the root README.",
    workspaceDir: "acme-monorepo",
    workspaceName: "acme",
    project: {
      name: "api",
      projectType: "app",
      directory: "packages/py",
    },
    integrations: ["fastapi", "github"],
    dependencyCommands: ["uv add fastapi uvicorn", "uv add --dev pytest ruff"],
    runTargets: [
      "pnpm nx run api:sync",
      "pnpm nx run api:uv",
      "pnpm nx run api:run",
      "pnpm nx run api:test",
      "pnpm nx run api:build",
    ],
  },
  {
    slug: "02-fastapi-docker-precommit",
    title:
      "02 [FastAPI](https://fastapi.tiangolo.com/) + [Docker](https://www.docker.com/) + [pre-commit](https://pre-commit.com/)",
    summary:
      "Service-oriented app with [FastAPI](https://fastapi.tiangolo.com/), [Docker](https://www.docker.com/), and local code-quality hooks.",
    workspaceDir: "acme-service",
    workspaceName: "acme-service",
    project: {
      name: "service",
      projectType: "app",
      directory: "packages/py",
    },
    integrations: ["fastapi", "docker", "pre-commit"],
    dependencyCommands: ["uv add fastapi uvicorn", "uv add --dev pytest ruff"],
    runTargets: [
      "pnpm nx run service:sync",
      "pnpm nx run service:test",
      "pnpm nx run service:build",
    ],
  },
  {
    slug: "03-lambda-alternative-indexes",
    title:
      "03 [AWS Lambda](https://aws.amazon.com/lambda/) + Alternative Indexes",
    summary:
      "[AWS Lambda](https://aws.amazon.com/lambda/) container packaging plus custom index snippet scaffolding.",
    workspaceDir: "acme-lambda",
    workspaceName: "acme-lambda",
    project: {
      name: "lambda-api",
      projectType: "app",
      directory: "packages/py",
    },
    integrations: ["aws-lambda", "alternative-indexes"],
    dependencyCommands: ["uv add boto3", "uv add --dev pytest ruff"],
    runTargets: [
      "pnpm nx run lambda-api:sync",
      "pnpm nx run lambda-api:test",
      "pnpm nx run lambda-api:build",
    ],
  },
  {
    slug: "04-notebooks-and-ml",
    title:
      "04 [Jupyter](https://jupyter.org/) + [marimo](https://marimo.io/) + [Coiled](https://coiled.io/) + [PyTorch](https://pytorch.org/)",
    summary:
      "Notebook and ML bootstrap with [Jupyter](https://jupyter.org/), [marimo](https://marimo.io/), [Coiled](https://coiled.io/), and [PyTorch](https://pytorch.org/).",
    workspaceDir: "acme-ml",
    workspaceName: "acme-ml",
    project: {
      name: "lab",
      projectType: "lib",
      directory: "packages/py",
    },
    integrations: ["jupyter", "marimo", "coiled", "pytorch"],
    dependencyCommands: [
      "uv add pandas pyarrow torch",
      "uv add --dev pytest ruff ipykernel marimo",
    ],
    runTargets: [
      "pnpm nx run lab:sync",
      "pnpm nx run lab:test",
      "pnpm nx run lab:build",
    ],
  },
  {
    slug: "05-dependency-automation-ci",
    title:
      "05 [Renovate](https://docs.renovatebot.com/) + [Dependabot](https://docs.github.com/en/code-security/dependabot) + CI",
    summary:
      "Dependency automation with [Renovate](https://docs.renovatebot.com/) and [Dependabot](https://docs.github.com/en/code-security/dependabot) plus [GitHub Actions](https://github.com/features/actions) and [GitLab CI/CD](https://docs.gitlab.com/ee/ci/) templates.",
    workspaceDir: "acme-ci",
    workspaceName: "acme-ci",
    project: {
      name: "shared",
      projectType: "lib",
      directory: "packages/py",
    },
    integrations: ["dependency-bots", "github", "gitlab", "pre-commit"],
    dependencyCommands: ["uv add httpx", "uv add --dev pytest ruff"],
    runTargets: [
      "pnpm nx run shared:sync",
      "pnpm nx run shared:test",
      "pnpm nx run shared:build",
    ],
  },
];

async function main() {
  ensureDir(SAMPLES_ROOT);
  removeManagedSamples();

  for (const sample of SAMPLE_DEFINITIONS) {
    const outputDir = path.join(SAMPLES_ROOT, sample.slug);
    ensureDir(outputDir);
    await generateSample(outputDir, sample);
  }

  writeFile(path.join(SAMPLES_ROOT, "README.md"), renderSamplesIndex());
  process.stdout.write(
    `Generated ${SAMPLE_DEFINITIONS.length} samples in samples/.\n`,
  );
}

function removeManagedSamples() {
  for (const sample of SAMPLE_DEFINITIONS) {
    const sampleDir = path.join(SAMPLES_ROOT, sample.slug);
    fs.rmSync(sampleDir, { recursive: true, force: true });
  }
}

async function generateSample(outputDir, sample) {
  const tree = createTreeWithEmptyWorkspace();

  await workspaceGenerator(tree, {
    name: sample.workspaceName,
    membersGlob: "packages/py/*",
  });

  await projectGenerator(tree, {
    name: sample.project.name,
    directory: sample.project.directory,
    projectType: sample.project.projectType,
  });

  for (const template of sample.integrations) {
    await integrationGenerator(tree, {
      template,
      ...(WORKSPACE_LEVEL_TEMPLATES.has(template)
        ? {}
        : { project: sample.project.name }),
    });
  }

  customizePackageJson(tree, sample);
  applyTreeToFs(tree, outputDir);
  writeFile(path.join(outputDir, "README.md"), renderSampleReadme(sample));
}

function customizePackageJson(tree, sample) {
  const current = JSON.parse(tree.read("package.json", "utf-8"));
  const pkg = {
    ...current,
    name: sample.workspaceDir,
    private: true,
    packageManager: "pnpm@10",
    devDependencies: {
      ...(current.devDependencies ?? {}),
      "@mgwilt/nx-uv": "beta",
      nx: "22.5.3",
    },
  };
  tree.write("package.json", `${JSON.stringify(pkg, null, 2)}\n`);
}

function applyTreeToFs(tree, outputDir) {
  for (const change of tree.listChanges()) {
    const absolute = path.join(outputDir, change.path);

    if (change.type === "DELETE") {
      fs.rmSync(absolute, { recursive: true, force: true });
      continue;
    }

    ensureDir(path.dirname(absolute));
    const content = Buffer.isBuffer(change.content)
      ? change.content
      : Buffer.from(change.content);
    fs.writeFileSync(absolute, content);
  }
}

function renderSamplesIndex() {
  const lines = [
    "# Samples",
    "",
    "These sample folders are auto-generated by `tools/generate-samples.cjs` using the real `@mgwilt/nx-uv` generators and integration templates.",
    "",
    "Regenerate all samples with:",
    "",
    "```bash",
    "pnpm samples:generate",
    "```",
    "",
    "## Available samples",
    "",
  ];

  for (const sample of SAMPLE_DEFINITIONS) {
    lines.push(`- [\`${sample.slug}\`](${sample.slug}/README.md)`);
    lines.push(`  - ${sample.summary}`);
  }

  lines.push("");
  lines.push(
    "Each sample README includes the full command sequence used to generate that sample.",
  );
  lines.push("");

  return lines.join("\n");
}

function renderSampleReadme(sample) {
  const commandLines = [
    `pnpm create nx-workspace@latest ${sample.workspaceDir} --preset=ts --packageManager=pnpm --nxCloud=skip --interactive=false`,
    `cd ${sample.workspaceDir}`,
    "pnpm add -D @mgwilt/nx-uv@beta",
    `pnpm nx g @mgwilt/nx-uv:workspace --name=${sample.workspaceName} --membersGlob=packages/py/*`,
    `pnpm nx g @mgwilt/nx-uv:project ${sample.project.name} --projectType=${sample.project.projectType} --directory=${sample.project.directory}`,
    ...sample.integrations.map((template) =>
      WORKSPACE_LEVEL_TEMPLATES.has(template)
        ? `pnpm nx g @mgwilt/nx-uv:integration --template=${template}`
        : `pnpm nx g @mgwilt/nx-uv:integration --template=${template} --project=${sample.project.name}`,
    ),
    `cd ${sample.project.directory}/${sample.project.name}`,
    ...sample.dependencyCommands,
    "cd ../../..",
  ];

  return [
    `# ${sample.title}`,
    "",
    `This sample is auto-generated by \`tools/generate-samples.cjs\` from the plugin generators in this repo.`,
    "",
    "## Generated with",
    "",
    "```bash",
    ...commandLines,
    "```",
    "",
    "## Run targets",
    "",
    "```bash",
    ...sample.runTargets,
    "```",
    "",
  ].join("\n");
}

function ensureDir(targetDir) {
  fs.mkdirSync(targetDir, { recursive: true });
}

function writeFile(filePath, content) {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, content.replace(/\r\n/g, "\n"), "utf-8");
}

main().catch((error) => {
  process.stderr.write(`${error?.stack ?? String(error)}\n`);
  process.exitCode = 1;
});
