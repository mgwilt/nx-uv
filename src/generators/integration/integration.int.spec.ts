import { Tree } from "@nx/devkit";
import { createTreeWithEmptyWorkspace } from "@nx/devkit/testing";

import { integrationGenerator } from "./integration";

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
    expect(workflow).toContain("-t test,lint,build");
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

    expect(pipeline).toContain("pnpm nx run-many -t test,lint,build --all");
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
});
