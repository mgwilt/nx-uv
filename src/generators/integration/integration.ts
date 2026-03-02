import {
  formatFiles,
  readProjectConfiguration,
  Tree,
  workspaceRoot,
} from "@nx/devkit";
import * as path from "path";
import { IntegrationGeneratorSchema, IntegrationTemplate } from "./schema";

type GeneratedFile = {
  path: string;
  content: string;
};

export async function integrationGenerator(
  tree: Tree,
  options: IntegrationGeneratorSchema,
) {
  const baseDir = resolveBaseDirectory(tree, options);
  const files = filesForTemplate(options.template, baseDir);

  for (const file of files) {
    if (tree.exists(file.path) && !options.overwrite) {
      continue;
    }

    tree.write(file.path, `${file.content.trimEnd()}\n`);
  }

  if (!options.skipFormat) {
    await formatFiles(tree);
  }
}

function resolveBaseDirectory(
  tree: Tree,
  options: IntegrationGeneratorSchema,
): string {
  if (options.project) {
    const project = readProjectConfiguration(tree, options.project);
    return project.root;
  }

  if (options.directory) {
    const absolute = path.resolve(workspaceRoot, options.directory);
    const relative = path.relative(workspaceRoot, absolute);
    return relative || ".";
  }

  return ".";
}

function filesForTemplate(
  template: IntegrationTemplate,
  baseDir: string,
): GeneratedFile[] {
  const inBase = (targetPath: string) =>
    baseDir === "." ? targetPath : path.posix.join(baseDir, targetPath);

  switch (template) {
    case "github":
      return [
        {
          path: ".github/workflows/uv-ci.yml",
          content: `name: nx-uv-ci

on:
  push:
  pull_request:

jobs:
  quality:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0
      - uses: pnpm/action-setup@v4
        with:
          version: 10
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: pnpm
      - name: Install dependencies
        run: pnpm install --frozen-lockfile
      - name: Derive base and head SHAs for Nx affected
        uses: nrwl/nx-set-shas@v4
      - name: Run affected quality targets
        run: >-
          pnpm nx affected
          -t test,lint,build
          --base="$NX_BASE"
          --head="$NX_HEAD"
          --outputStyle=static
`,
        },
      ];
    case "gitlab":
      return [
        {
          path: ".gitlab-ci.uv.yml",
          content: `stages:
  - quality

quality:nx:
  image: node:20-bookworm-slim
  stage: quality
  variables:
    NX_DAEMON: "false"
  before_script:
    - corepack enable
    - corepack prepare pnpm@10 --activate
    - pnpm install --frozen-lockfile
  script:
    - pnpm nx run-many -t test,lint,build --all --outputStyle=static
`,
        },
      ];
    case "docker":
      return [
        {
          path: inBase("Dockerfile"),
          content: `FROM ghcr.io/astral-sh/uv:python3.12-bookworm-slim
WORKDIR /app
COPY pyproject.toml uv.lock* ./
RUN uv sync --frozen --no-dev
COPY . .
CMD ["uv", "run", "--", "python", "-m", "main"]
`,
        },
      ];
    case "aws-lambda":
      return [
        {
          path: inBase("Dockerfile.lambda"),
          content: `FROM public.ecr.aws/lambda/python:3.12
COPY --from=ghcr.io/astral-sh/uv:latest /uv /uvx /bin/
WORKDIR /var/task
COPY pyproject.toml uv.lock* ./
RUN uv export --format requirements-txt > requirements.txt \\
  && uv pip install --system --no-emit-workspace --no-dev -r requirements.txt \\
  && rm requirements.txt
COPY . .
CMD ["main.handler"]
`,
        },
      ];
    case "dependency-bots":
      return [
        {
          path: "renovate.json",
          content: `{
  "$schema": "https://docs.renovatebot.com/renovate-schema.json",
  "extends": ["config:recommended"],
  "enabledManagers": ["pep621", "pip_requirements", "github-actions"]
}
`,
        },
        {
          path: ".github/dependabot.yml",
          content: `version: 2
updates:
  - package-ecosystem: "github-actions"
    directory: "/"
    schedule:
      interval: "weekly"
`,
        },
      ];
    case "pre-commit":
      return [
        {
          path: ".pre-commit-config.yaml",
          content: `repos:
  - repo: local
    hooks:
      - id: ruff
        name: ruff
        entry: uvx ruff check .
        language: system
      - id: pytest
        name: pytest
        entry: uv run -- pytest -q
        language: system
        pass_filenames: false
`,
        },
      ];
    case "jupyter":
      return [
        {
          path: inBase("scripts/setup-jupyter-kernel.sh"),
          content: `#!/usr/bin/env bash
set -euo pipefail
uv add --dev ipykernel
uv run -- python -m ipykernel install --user --name uv-kernel
`,
        },
      ];
    case "marimo":
      return [
        {
          path: inBase("notebooks/example.marimo.py"),
          content: `# /// script
# requires-python = ">=3.11"
# dependencies = ["marimo"]
# ///

import marimo

app = marimo.App()

if __name__ == "__main__":
    app.run()
`,
        },
      ];
    case "pytorch":
      return [
        {
          path: inBase("uv.pytorch.toml.snippet"),
          content: `[[tool.uv.index]]
name = "pytorch"
url = "https://download.pytorch.org/whl/cpu"
explicit = true

[tool.uv.sources]
torch = { index = "pytorch" }
`,
        },
      ];
    case "fastapi":
      return [
        {
          path: inBase("main.py"),
          content: `from fastapi import FastAPI

app = FastAPI()


@app.get("/")
def root() -> dict[str, str]:
    return {"message": "hello"}
`,
        },
        {
          path: inBase("Dockerfile.fastapi"),
          content: `FROM ghcr.io/astral-sh/uv:python3.12-bookworm-slim
WORKDIR /app
COPY . .
RUN uv sync --frozen
CMD ["uv", "run", "--", "uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
`,
        },
      ];
    case "alternative-indexes":
      return [
        {
          path: inBase("uv.indexes.toml.snippet"),
          content: `[[tool.uv.index]]
name = "internal"
url = "https://example.com/simple"
default = true
`,
        },
      ];
    case "coiled":
      return [
        {
          path: inBase("scripts/coiled-example.py"),
          content: `# /// script
# requires-python = ">=3.11"
# dependencies = ["coiled", "pandas", "pyarrow"]
# ///

import pandas as pd

print(pd.DataFrame({"hello": ["uv"]}))
`,
        },
      ];
    default:
      return [];
  }
}

export default integrationGenerator;
