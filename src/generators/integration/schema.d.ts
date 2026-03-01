export type IntegrationTemplate =
  | "alternative-indexes"
  | "aws-lambda"
  | "coiled"
  | "dependency-bots"
  | "docker"
  | "fastapi"
  | "github"
  | "gitlab"
  | "jupyter"
  | "marimo"
  | "pre-commit"
  | "pytorch";

export interface IntegrationGeneratorSchema {
  template: IntegrationTemplate;
  project?: string;
  directory?: string;
  overwrite?: boolean;
  skipFormat?: boolean;
}
