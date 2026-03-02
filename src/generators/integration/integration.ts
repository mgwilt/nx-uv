import {
  formatFiles,
  readProjectConfiguration,
  Tree,
  workspaceRoot,
} from "@nx/devkit";
import * as path from "path";
import { IntegrationGeneratorSchema } from "./schema";
import {
  IntegrationTemplate,
  PytorchBackend,
  PYTORCH_BACKENDS,
} from "./templates";

type GeneratedFile = {
  path: string;
  content: string;
};

type TemplateContext = {
  baseDir: string;
  inBase: (targetPath: string) => string;
  options: IntegrationGeneratorSchema;
  pytorch: ResolvedPytorchOptions;
};

type TemplateDefinition = {
  generate: (context: TemplateContext) => GeneratedFile[];
};

type ResolvedPytorchOptions = {
  backend: PytorchBackend;
  includeNotebook: boolean;
  includeDocker: boolean;
};

const PYTORCH_PACKAGE_VERSIONS = {
  torch: "2.5.1",
  torchvision: "0.20.1",
  torchaudio: "2.5.1",
} as const;

const PYTORCH_CHANNELS = {
  cuda: "cu124",
  rocm: "rocm6.2.4",
  cpu: "cpu",
} as const;

const PYTORCH_INDEX_URLS: Record<PytorchBackend, string> = {
  cuda: "https://download.pytorch.org/whl/cu124",
  rocm: "https://download.pytorch.org/whl/rocm6.2.4",
  cpu: "https://download.pytorch.org/whl/cpu",
};

const PYTORCH_INDEX_NAMES: Record<PytorchBackend, string> = {
  cuda: "pytorch-cu124",
  rocm: "pytorch-rocm624",
  cpu: "pytorch-cpu",
};

const PYTORCH_BACKEND_LABELS: Record<PytorchBackend, string> = {
  cuda: "CUDA 12.4",
  rocm: "ROCm 6.2.4",
  cpu: "CPU",
};

const NVIDIA_CUDA_BASE_IMAGE = "nvidia/cuda:12.4.1-cudnn-runtime-ubuntu22.04";

const TEMPLATE_DEFINITIONS: Record<IntegrationTemplate, TemplateDefinition> = {
  github: {
    generate: () => [
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
      - uses: astral-sh/setup-uv@v4
        with:
          enable-cache: false
      - name: Install dependencies
        run: pnpm install --frozen-lockfile
      - name: Derive base and head SHAs for Nx affected
        uses: nrwl/nx-set-shas@v4
      - name: Run affected quality targets
        run: >-
          pnpm nx affected
          -t test,lint,typecheck,build
          --base="$NX_BASE"
          --head="$NX_HEAD"
          --outputStyle=static
`,
      },
    ],
  },
  gitlab: {
    generate: () => [
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
    - curl -LsSf https://astral.sh/uv/install.sh | sh
    - export PATH="$HOME/.local/bin:$PATH"
    - corepack enable
    - corepack prepare pnpm@10 --activate
    - pnpm install --frozen-lockfile
  script:
    - pnpm nx run-many -t test,lint,typecheck,build --all --outputStyle=static
`,
      },
    ],
  },
  docker: {
    generate: ({ inBase }) => [
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
    ],
  },
  "aws-lambda": {
    generate: ({ inBase }) => [
      {
        path: inBase("Dockerfile.lambda"),
        content: `FROM public.ecr.aws/lambda/python:3.12
COPY --from=ghcr.io/astral-sh/uv:0.10.7 /uv /uvx /bin/
WORKDIR /var/task
COPY pyproject.toml uv.lock* ./
RUN uv export --format requirements-txt > requirements.txt \\
  && uv pip install --system --no-emit-workspace --no-dev -r requirements.txt \\
  && rm requirements.txt
COPY . .
CMD ["main.handler"]
`,
      },
    ],
  },
  "dependency-bots": {
    generate: () => [
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
    ],
  },
  "pre-commit": {
    generate: () => [
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
    ],
  },
  jupyter: {
    generate: ({ inBase }) => [
      {
        path: inBase("scripts/setup-jupyter-kernel.sh"),
        content: `#!/usr/bin/env bash
set -euo pipefail
uv add --dev ipykernel
uv run -- python -m ipykernel install --user --name uv-kernel
`,
      },
    ],
  },
  marimo: {
    generate: ({ inBase }) => [
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
    ],
  },
  pytorch: {
    generate: ({ inBase, pytorch }) => {
      const files: GeneratedFile[] = [
        {
          path: inBase("uv.pytorch.toml.snippet"),
          content: renderPytorchSnippet(pytorch.backend),
        },
      ];

      if (pytorch.includeNotebook) {
        files.push(
          {
            path: inBase("notebooks/pytorch-inference.ipynb"),
            content: renderPytorchNotebookIpynb(pytorch.backend),
          },
          {
            path: inBase("notebooks/pytorch-inference.marimo.py"),
            content: renderPytorchMarimoNotebook(pytorch.backend),
          },
        );
      }

      if (pytorch.includeDocker && pytorch.backend === "cuda") {
        files.push(
          {
            path: inBase("Dockerfile.inference.nvidia"),
            content: renderNvidiaInferenceDockerfile(),
          },
          {
            path: inBase("compose.inference.nvidia.yml"),
            content: renderNvidiaInferenceCompose(),
          },
          {
            path: inBase("scripts/pytorch_inference_smoke.py"),
            content: renderNvidiaInferenceSmokeScript(),
          },
        );
      }

      return files;
    },
  },
  fastapi: {
    generate: ({ inBase }) => [
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
    ],
  },
  "alternative-indexes": {
    generate: ({ inBase }) => [
      {
        path: inBase("uv.indexes.toml.snippet"),
        content: `[[tool.uv.index]]
name = "internal"
url = "https://example.com/simple"
default = true
`,
      },
    ],
  },
  coiled: {
    generate: ({ inBase }) => [
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
    ],
  },
};

export async function integrationGenerator(
  tree: Tree,
  options: IntegrationGeneratorSchema,
) {
  const baseDir = resolveBaseDirectory(tree, options);
  const definition = TEMPLATE_DEFINITIONS[options.template];

  if (!definition) {
    throw new Error(`Unsupported integration template: ${options.template}`);
  }

  const pytorch = resolvePytorchOptions(options);
  validateTemplateOptions(options.template, pytorch);

  const inBase = (targetPath: string) =>
    baseDir === "." ? targetPath : path.posix.join(baseDir, targetPath);
  const files = definition.generate({ baseDir, inBase, options, pytorch });

  for (const file of files) {
    if (tree.exists(file.path) && !options.overwrite) {
      continue;
    }

    tree.write(file.path, `${file.content.trimEnd()}\n`);
  }

  const hasIpynb = files.some((file) => file.path.endsWith(".ipynb"));
  if (!options.skipFormat && !hasIpynb) {
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

function resolvePytorchOptions(
  options: IntegrationGeneratorSchema,
): ResolvedPytorchOptions {
  const backend = PYTORCH_BACKENDS.includes(options.backend as PytorchBackend)
    ? (options.backend as PytorchBackend)
    : "cuda";
  const includeDockerDefault = backend === "cuda";

  return {
    backend,
    includeNotebook: options.includeNotebook ?? true,
    includeDocker: options.includeDocker ?? includeDockerDefault,
  };
}

function validateTemplateOptions(
  template: IntegrationTemplate,
  pytorch: ResolvedPytorchOptions,
) {
  if (template !== "pytorch") {
    return;
  }

  if (pytorch.includeDocker && pytorch.backend !== "cuda") {
    throw new Error(
      "template=pytorch with includeDocker=true currently supports backend=cuda only.",
    );
  }
}

function renderPytorchSnippet(backend: PytorchBackend): string {
  const indexName = PYTORCH_INDEX_NAMES[backend];
  const indexUrl = PYTORCH_INDEX_URLS[backend];
  const backendLabel = PYTORCH_BACKEND_LABELS[backend];
  const channel = PYTORCH_CHANNELS[backend];

  return `# PyTorch ${backendLabel} snippet for pyproject.toml.
# Pinned package set:
#   torch==${PYTORCH_PACKAGE_VERSIONS.torch}
#   torchvision==${PYTORCH_PACKAGE_VERSIONS.torchvision}
#   torchaudio==${PYTORCH_PACKAGE_VERSIONS.torchaudio}
# Suggested install command:
#   uv add "torch==${PYTORCH_PACKAGE_VERSIONS.torch}" "torchvision==${PYTORCH_PACKAGE_VERSIONS.torchvision}" "torchaudio==${PYTORCH_PACKAGE_VERSIONS.torchaudio}"
# Backend channel: ${channel}

[[tool.uv.index]]
name = "${indexName}"
url = "${indexUrl}"
explicit = true

[tool.uv.sources]
torch = { index = "${indexName}" }
torchvision = { index = "${indexName}" }
torchaudio = { index = "${indexName}" }
`;
}

function renderPytorchNotebookIpynb(backend: PytorchBackend): string {
  const notebook = {
    cells: [
      {
        cell_type: "markdown",
        metadata: {},
        source: [
          "# PyTorch Inference Notebook\n",
          "\n",
          `Backend profile: **${PYTORCH_BACKEND_LABELS[backend]}**.\n`,
          "\n",
          "If running in Docker with NVIDIA GPUs, start with `--gpus all` and ensure host GPU prerequisites are installed.\n",
        ],
      },
      {
        cell_type: "code",
        execution_count: null,
        metadata: {},
        outputs: [],
        source: [
          "import torch\n",
          "\n",
          `EXPECTED_BACKEND = "${backend}"\n`,
          'print(f"PyTorch version: {torch.__version__}")\n',
          'print(f"Built for CUDA: {torch.version.cuda}")\n',
          'print(f"Built for ROCm/HIP: {torch.version.hip}")\n',
          'print(f"CUDA visible at runtime: {torch.cuda.is_available()}")\n',
          "\n",
          'device = "cuda" if torch.cuda.is_available() else "cpu"\n',
          "x = torch.randn(1, 4, device=device)\n",
          "model = torch.nn.Sequential(\n",
          "    torch.nn.Linear(4, 8),\n",
          "    torch.nn.ReLU(),\n",
          "    torch.nn.Linear(8, 2),\n",
          ").to(device)\n",
          "with torch.no_grad():\n",
          "    y = model(x)\n",
          "\n",
          'print(f"Device used: {device}")\n',
          'print(f"Output tensor: {y}")\n',
          'print(f"Expected backend profile: {EXPECTED_BACKEND}")\n',
        ],
      },
    ],
    metadata: {
      kernelspec: {
        display_name: "Python 3",
        language: "python",
        name: "python3",
      },
      language_info: {
        name: "python",
      },
    },
    nbformat: 4,
    nbformat_minor: 5,
  };

  return JSON.stringify(notebook, null, 2);
}

function renderPytorchMarimoNotebook(backend: PytorchBackend): string {
  return `# /// script
# requires-python = ">=3.11"
# dependencies = ["marimo", "torch==${PYTORCH_PACKAGE_VERSIONS.torch}", "torchvision==${PYTORCH_PACKAGE_VERSIONS.torchvision}", "torchaudio==${PYTORCH_PACKAGE_VERSIONS.torchaudio}"]
# ///

import marimo
import torch

app = marimo.App()


@app.cell
def _():
    expected_backend = "${backend}"
    print(f"PyTorch version: {torch.__version__}")
    print(f"CUDA build: {torch.version.cuda}")
    print(f"HIP build: {torch.version.hip}")
    print(f"CUDA available at runtime: {torch.cuda.is_available()}")
    print(f"Expected backend profile: {expected_backend}")
    device = "cuda" if torch.cuda.is_available() else "cpu"
    model = torch.nn.Linear(4, 2).to(device)
    x = torch.randn(1, 4, device=device)
    with torch.no_grad():
        y = model(x)
    print(f"Device used: {device}")
    print(f"Inference output: {y}")
    return device, expected_backend, model, x, y


if __name__ == "__main__":
    app.run()
`;
}

function renderNvidiaInferenceDockerfile(): string {
  return `FROM ${NVIDIA_CUDA_BASE_IMAGE}

ENV DEBIAN_FRONTEND=noninteractive \\
    PYTHONDONTWRITEBYTECODE=1 \\
    PYTHONUNBUFFERED=1

RUN apt-get update \\
  && apt-get install -y --no-install-recommends python3 python3-pip ca-certificates \\
  && rm -rf /var/lib/apt/lists/*

COPY --from=ghcr.io/astral-sh/uv:0.10.7 /uv /uvx /bin/

WORKDIR /app
COPY pyproject.toml uv.lock* ./
RUN uv sync --frozen --no-dev

COPY . .

CMD ["uv", "run", "--", "python", "scripts/pytorch_inference_smoke.py"]
`;
}

function renderNvidiaInferenceCompose(): string {
  return `# Requires NVIDIA Container Toolkit on Linux (or NVIDIA driver + WSL2 backend on Windows).
services:
  pytorch-inference:
    build:
      context: .
      dockerfile: Dockerfile.inference.nvidia
    command: ['uv', 'run', '--', 'python', 'scripts/pytorch_inference_smoke.py']
    deploy:
      resources:
        reservations:
          devices:
            - driver: nvidia
              count: 1
              capabilities: [gpu]
`;
}

function renderNvidiaInferenceSmokeScript(): string {
  return `import torch


def main() -> None:
    print(f"PyTorch: {torch.__version__}")
    print(f"CUDA build: {torch.version.cuda}")
    print(f"HIP build: {torch.version.hip}")
    print(f"CUDA runtime available: {torch.cuda.is_available()}")

    if not torch.cuda.is_available():
        raise RuntimeError(
            "CUDA is not available. Start the container with --gpus all and ensure NVIDIA runtime prerequisites are installed.",
        )

    device = torch.device("cuda")
    model = torch.nn.Sequential(
        torch.nn.Linear(4, 16),
        torch.nn.ReLU(),
        torch.nn.Linear(16, 2),
    ).to(device)
    x = torch.randn(1, 4, device=device)

    with torch.no_grad():
        y = model(x)

    print(f"Inference device: {device}")
    print(f"Output tensor: {y}")


if __name__ == "__main__":
    main()
`;
}

export default integrationGenerator;
