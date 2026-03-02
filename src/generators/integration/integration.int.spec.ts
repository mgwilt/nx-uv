import { addProjectConfiguration, Tree } from "@nx/devkit";
import { createTreeWithEmptyWorkspace } from "@nx/devkit/testing";

import { integrationGenerator } from "./integration";
import { IntegrationTemplate } from "./schema";

describe("integration generator", () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
  });

  it("generates a GitHub Actions template that runs Nx affected targets", async () => {
    await integrationGenerator(tree, {
      template: "github",
      skipFormat: true,
    });

    const workflow = tree.read(".github/workflows/uv-ci.yml", "utf-8") ?? "";

    expect(workflow).toContain("pnpm nx affected");
    expect(workflow).toContain("-t test,lint,typecheck,build");
    expect(workflow).toContain("nrwl/nx-set-shas@v4");
    expect(workflow).toContain("astral-sh/setup-uv@v4");
    expect(workflow).toContain("enable-cache: false");
    expect(workflow).not.toContain("uv sync --frozen");
    expect(workflow).not.toContain("uv run -- pytest -q");
  });

  it("generates a GitLab template that runs Nx targets", async () => {
    await integrationGenerator(tree, {
      template: "gitlab",
      skipFormat: true,
    });

    const pipeline = tree.read(".gitlab-ci.uv.yml", "utf-8") ?? "";

    expect(pipeline).toContain(
      "pnpm nx run-many -t test,lint,typecheck,build --all",
    );
    expect(pipeline).toContain(
      "curl -LsSf https://astral.sh/uv/install.sh | sh",
    );
    expect(pipeline).toContain('export PATH="$HOME/.local/bin:$PATH"');
    expect(pipeline).toContain("corepack prepare pnpm@10 --activate");
    expect(pipeline).not.toContain("uv sync --frozen");
    expect(pipeline).not.toContain("uv run -- pytest -q");
  });

  it("generates a Lambda Dockerfile without bash-only process substitution", async () => {
    await integrationGenerator(tree, {
      template: "aws-lambda",
      directory: "packages/py/lambda-api",
      skipFormat: true,
    });

    const dockerfile =
      tree.read("packages/py/lambda-api/Dockerfile.lambda", "utf-8") ?? "";

    expect(dockerfile).toContain(
      "uv export --format requirements-txt > requirements.txt",
    );
    expect(dockerfile).toContain(
      "uv pip install --system --no-emit-workspace --no-dev -r requirements.txt",
    );
    expect(dockerfile).toContain("ghcr.io/astral-sh/uv:0.10.7");
    expect(dockerfile).not.toContain("ghcr.io/astral-sh/uv:latest");
    expect(dockerfile).not.toContain("<(uv export --format requirements-txt)");
  });

  it("does not overwrite existing files unless overwrite is enabled", async () => {
    tree.write(".github/workflows/uv-ci.yml", "existing-workflow\n");

    await integrationGenerator(tree, {
      template: "github",
      overwrite: false,
      skipFormat: true,
    });

    const workflow = tree.read(".github/workflows/uv-ci.yml", "utf-8") ?? "";

    expect(workflow).toBe("existing-workflow\n");
  });

  it("generates the remaining integration templates at workspace root", async () => {
    const cases: Array<{
      template: IntegrationTemplate;
      expectedPath: string;
      expectedSnippet: string;
    }> = [
      {
        template: "docker",
        expectedPath: "Dockerfile",
        expectedSnippet: "RUN uv sync --frozen --no-dev",
      },
      {
        template: "dependency-bots",
        expectedPath: "renovate.json",
        expectedSnippet:
          '"enabledManagers": ["pep621", "pip_requirements", "github-actions"]',
      },
      {
        template: "pre-commit",
        expectedPath: ".pre-commit-config.yaml",
        expectedSnippet: "uvx ruff check .",
      },
      {
        template: "jupyter",
        expectedPath: "scripts/setup-jupyter-kernel.sh",
        expectedSnippet: "ipykernel install --user --name uv-kernel",
      },
      {
        template: "marimo",
        expectedPath: "notebooks/example.marimo.py",
        expectedSnippet: "app = marimo.App()",
      },
      {
        template: "pytorch",
        expectedPath: "uv.pytorch.toml.snippet",
        expectedSnippet: 'url = "https://download.pytorch.org/whl/cpu"',
      },
      {
        template: "fastapi",
        expectedPath: "Dockerfile.fastapi",
        expectedSnippet: "uvicorn",
      },
      {
        template: "alternative-indexes",
        expectedPath: "uv.indexes.toml.snippet",
        expectedSnippet: 'name = "internal"',
      },
      {
        template: "coiled",
        expectedPath: "scripts/coiled-example.py",
        expectedSnippet: "import pandas as pd",
      },
    ];

    for (const testCase of cases) {
      await integrationGenerator(tree, {
        template: testCase.template,
        skipFormat: true,
      });

      const generated = tree.read(testCase.expectedPath, "utf-8") ?? "";
      expect(generated).toContain(testCase.expectedSnippet);
    }
  });

  it("resolves base directory from project configuration", async () => {
    addProjectConfiguration(tree, "api", {
      root: "packages/py/api",
      sourceRoot: "packages/py/api/src",
      projectType: "application",
      targets: {},
    });

    await integrationGenerator(tree, {
      template: "fastapi",
      project: "api",
      skipFormat: true,
    });

    expect(tree.exists("packages/py/api/main.py")).toBe(true);
    expect(tree.exists("packages/py/api/Dockerfile.fastapi")).toBe(true);
  });

  it("normalizes directory='.' to the workspace root", async () => {
    await integrationGenerator(tree, {
      template: "docker",
      directory: ".",
      skipFormat: true,
    });

    expect(tree.exists("Dockerfile")).toBe(true);
  });

  it("runs formatting when skipFormat is not provided", async () => {
    await integrationGenerator(tree, {
      template: "dependency-bots",
    });

    expect(tree.exists("renovate.json")).toBe(true);
    expect(tree.exists(".github/dependabot.yml")).toBe(true);
  });

  it("throws for unsupported template values", async () => {
    await expect(
      integrationGenerator(tree, {
        template: "unsupported-template" as IntegrationTemplate,
        skipFormat: true,
      }),
    ).rejects.toThrow("Unsupported integration template: unsupported-template");
  });
});
