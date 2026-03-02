#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const path = require("node:path");

require("@swc-node/register");

const {
  WORKSPACE_LEVEL_INTEGRATION_TEMPLATES,
} = require("../src/generators/integration/templates.ts");

const REPO_ROOT = path.resolve(__dirname, "..");
const SAMPLES_ROOT = path.join(REPO_ROOT, "samples");
const WORKSPACE_LEVEL_TEMPLATES = new Set(
  WORKSPACE_LEVEL_INTEGRATION_TEMPLATES,
);

function integrationStep(template, options = {}) {
  return { template, options };
}

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
    integrationSteps: [integrationStep("fastapi"), integrationStep("github")],
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
    integrationSteps: [
      integrationStep("fastapi"),
      integrationStep("docker"),
      integrationStep("pre-commit"),
    ],
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
    integrationSteps: [
      integrationStep("aws-lambda"),
      integrationStep("alternative-indexes"),
    ],
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
    integrationSteps: [
      integrationStep("jupyter"),
      integrationStep("marimo"),
      integrationStep("coiled"),
      integrationStep("pytorch", {
        backend: "cpu",
        includeNotebook: false,
        includeDocker: false,
      }),
    ],
    dependencyCommands: [
      'uv add pandas pyarrow "torch==2.5.1" "torchvision==0.20.1" "torchaudio==2.5.1"',
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
    integrationSteps: [
      integrationStep("dependency-bots"),
      integrationStep("github"),
      integrationStep("gitlab"),
      integrationStep("pre-commit"),
    ],
    dependencyCommands: ["uv add httpx", "uv add --dev pytest ruff"],
    runTargets: [
      "pnpm nx run shared:sync",
      "pnpm nx run shared:test",
      "pnpm nx run shared:build",
    ],
  },
  {
    slug: "06-pytorch-cuda-nvidia-inference",
    title:
      "06 [PyTorch](https://pytorch.org/) CUDA + NVIDIA Inference [Docker](https://www.docker.com/)",
    summary:
      "GPU-first [PyTorch](https://pytorch.org/) setup with CUDA wheel source, notebooks, and NVIDIA inference container scaffolding.",
    workspaceDir: "acme-cuda",
    workspaceName: "acme-cuda",
    project: {
      name: "inference",
      projectType: "app",
      directory: "packages/py",
    },
    integrationSteps: [
      integrationStep("jupyter"),
      integrationStep("pytorch", {
        backend: "cuda",
        includeNotebook: true,
        includeDocker: true,
      }),
    ],
    dependencyCommands: [
      'uv add "torch==2.5.1" "torchvision==0.20.1" "torchaudio==2.5.1"',
      "uv add --dev pytest ruff ipykernel",
    ],
    runTargets: [
      "pnpm nx run inference:sync",
      "pnpm nx run inference:test",
      "pnpm nx run inference:build",
    ],
  },
  {
    slug: "07-pytorch-rocm-notebooks",
    title: "07 [PyTorch](https://pytorch.org/) ROCm + Notebook Workflows",
    summary:
      "ROCm-oriented [PyTorch](https://pytorch.org/) setup with pinned wheel source and generated notebook examples.",
    workspaceDir: "acme-rocm",
    workspaceName: "acme-rocm",
    project: {
      name: "rocm-lab",
      projectType: "lib",
      directory: "packages/py",
    },
    integrationSteps: [
      integrationStep("jupyter"),
      integrationStep("pytorch", {
        backend: "rocm",
        includeNotebook: true,
        includeDocker: false,
      }),
    ],
    dependencyCommands: [
      'uv add "torch==2.5.1" "torchvision==0.20.1" "torchaudio==2.5.1"',
      "uv add --dev pytest ruff ipykernel",
    ],
    runTargets: [
      "pnpm nx run rocm-lab:sync",
      "pnpm nx run rocm-lab:test",
      "pnpm nx run rocm-lab:build",
    ],
  },
];

/* v8 ignore next -- runtime dependency wiring for direct CLI execution */
function resolveGeneratorDependencies() {
  const { createTreeWithEmptyWorkspace } = require("@nx/devkit/testing");
  const {
    workspaceGenerator,
  } = require("../src/generators/workspace/workspace.ts");
  const { projectGenerator } = require("../src/generators/project/project.ts");
  const {
    integrationGenerator,
  } = require("../src/generators/integration/integration.ts");

  return {
    createTreeWithEmptyWorkspace,
    workspaceGenerator,
    projectGenerator,
    integrationGenerator,
    workspaceLevelTemplates: WORKSPACE_LEVEL_TEMPLATES,
  };
}

async function main(options = {}) {
  const {
    samplesRoot = SAMPLES_ROOT,
    sampleDefinitions = SAMPLE_DEFINITIONS,
    pathModule = path,
    fileSystem = fs,
    writeStdout = (value) => process.stdout.write(value),
    generateSampleImpl = generateSample,
    renderSamplesIndexImpl = renderSamplesIndex,
  } = options;

  ensureDir(samplesRoot, fileSystem);
  removeManagedSamples(samplesRoot, sampleDefinitions, fileSystem, pathModule);

  for (const sample of sampleDefinitions) {
    const outputDir = pathModule.join(samplesRoot, sample.slug);
    ensureDir(outputDir, fileSystem);
    await generateSampleImpl(
      outputDir,
      sample,
      undefined,
      fileSystem,
      pathModule,
    );
  }

  writeFile(
    pathModule.join(samplesRoot, "README.md"),
    renderSamplesIndexImpl(sampleDefinitions),
    fileSystem,
    pathModule,
  );
  writeStdout(
    `Generated ${sampleDefinitions.length} samples in ${samplesRoot}.\n`,
  );
}

function removeManagedSamples(
  samplesRoot = SAMPLES_ROOT,
  sampleDefinitions = SAMPLE_DEFINITIONS,
  fileSystem = fs,
  pathModule = path,
) {
  for (const sample of sampleDefinitions) {
    const sampleDir = pathModule.join(samplesRoot, sample.slug);
    fileSystem.rmSync(sampleDir, { recursive: true, force: true });
  }
}

async function generateSample(
  outputDir,
  sample,
  generatorDependencies = resolveGeneratorDependencies(),
  fileSystem = fs,
  pathModule = path,
) {
  const {
    createTreeWithEmptyWorkspace,
    workspaceGenerator,
    projectGenerator,
    integrationGenerator,
    workspaceLevelTemplates = WORKSPACE_LEVEL_TEMPLATES,
  } = generatorDependencies;
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

  for (const step of getIntegrationSteps(sample)) {
    await integrationGenerator(
      tree,
      buildIntegrationGeneratorOptions(
        step,
        sample.project.name,
        workspaceLevelTemplates,
      ),
    );
  }

  customizePackageJson(tree, sample);
  applyTreeToFs(tree, outputDir, fileSystem, pathModule);
  writeFile(
    pathModule.join(outputDir, "README.md"),
    renderSampleReadme(sample, workspaceLevelTemplates),
    fileSystem,
    pathModule,
  );
}

function getIntegrationSteps(sample) {
  if (Array.isArray(sample.integrationSteps)) {
    return sample.integrationSteps;
  }

  if (Array.isArray(sample.integrations)) {
    return sample.integrations.map((template) => integrationStep(template));
  }

  return [];
}

function buildIntegrationGeneratorOptions(
  step,
  projectName,
  workspaceLevelTemplates = WORKSPACE_LEVEL_TEMPLATES,
) {
  const options = {
    template: step.template,
    ...(step.options ?? {}),
  };

  if (!workspaceLevelTemplates.has(step.template)) {
    options.project = projectName;
  }

  return options;
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

function applyTreeToFs(tree, outputDir, fileSystem = fs, pathModule = path) {
  for (const change of tree.listChanges()) {
    const absolute = pathModule.join(outputDir, change.path);

    if (change.type === "DELETE") {
      fileSystem.rmSync(absolute, { recursive: true, force: true });
      continue;
    }

    ensureDir(pathModule.dirname(absolute), fileSystem);
    const content = Buffer.isBuffer(change.content)
      ? change.content
      : Buffer.from(change.content);
    fileSystem.writeFileSync(absolute, content);
  }
}

function renderSamplesIndex(sampleDefinitions = SAMPLE_DEFINITIONS) {
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

  for (const sample of sampleDefinitions) {
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

function renderSampleReadme(
  sample,
  workspaceLevelTemplates = WORKSPACE_LEVEL_TEMPLATES,
) {
  const commandLines = [
    `pnpm create nx-workspace@latest ${sample.workspaceDir} --preset=ts --packageManager=pnpm --nxCloud=skip --interactive=false`,
    `cd ${sample.workspaceDir}`,
    "pnpm add -D @mgwilt/nx-uv@beta",
    `pnpm nx g @mgwilt/nx-uv:workspace --name=${sample.workspaceName} --membersGlob='packages/py/*'`,
    `pnpm nx g @mgwilt/nx-uv:project ${sample.project.name} --projectType=${sample.project.projectType} --directory=${sample.project.directory}`,
    ...getIntegrationSteps(sample).map((step) =>
      renderIntegrationStepCommand(
        step,
        sample.project.name,
        workspaceLevelTemplates,
      ),
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

function renderIntegrationStepCommand(
  step,
  projectName,
  workspaceLevelTemplates = WORKSPACE_LEVEL_TEMPLATES,
) {
  const args = [
    "pnpm nx g @mgwilt/nx-uv:integration",
    `--template=${step.template}`,
  ];

  if (!workspaceLevelTemplates.has(step.template)) {
    args.push(`--project=${projectName}`);
  }

  const optionArgs = Object.entries(step.options ?? {})
    .filter(([, value]) => value !== undefined)
    .map(([key, value]) => `--${key}=${String(value)}`);

  args.push(...optionArgs);
  return args.join(" ");
}

function ensureDir(targetDir, fileSystem = fs) {
  fileSystem.mkdirSync(targetDir, { recursive: true });
}

function writeFile(filePath, content, fileSystem = fs, pathModule = path) {
  ensureDir(pathModule.dirname(filePath), fileSystem);
  fileSystem.writeFileSync(filePath, content.replace(/\r\n/g, "\n"), "utf-8");
}

async function runGenerateSamplesCli(runner = main) {
  try {
    await runner();
    return true;
  } catch (error) {
    process.stderr.write(`${error?.stack ?? String(error)}\n`);
    process.exitCode = 1;
    return false;
  }
}

/* v8 ignore next -- only exercised when invoked directly as a CLI */
if (require.main === module) {
  runGenerateSamplesCli();
}

module.exports = {
  SAMPLE_DEFINITIONS,
  WORKSPACE_LEVEL_TEMPLATES,
  integrationStep,
  resolveGeneratorDependencies,
  getIntegrationSteps,
  buildIntegrationGeneratorOptions,
  main,
  removeManagedSamples,
  generateSample,
  customizePackageJson,
  applyTreeToFs,
  renderSamplesIndex,
  renderSampleReadme,
  renderIntegrationStepCommand,
  ensureDir,
  writeFile,
  runGenerateSamplesCli,
};
