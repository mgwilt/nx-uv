export const INTEGRATION_TEMPLATES = [
  "alternative-indexes",
  "aws-lambda",
  "coiled",
  "dependency-bots",
  "docker",
  "fastapi",
  "github",
  "gitlab",
  "jupyter",
  "marimo",
  "pre-commit",
  "pytorch",
] as const;

export type IntegrationTemplate = (typeof INTEGRATION_TEMPLATES)[number];

export const WORKSPACE_LEVEL_INTEGRATION_TEMPLATES =
  new Set<IntegrationTemplate>([
    "github",
    "gitlab",
    "dependency-bots",
    "pre-commit",
  ]);

export const PYTORCH_BACKENDS = ["cuda", "rocm", "cpu"] as const;

export type PytorchBackend = (typeof PYTORCH_BACKENDS)[number];
