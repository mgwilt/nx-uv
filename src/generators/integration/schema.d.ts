import type { IntegrationTemplate, PytorchBackend } from "./templates";

export type { IntegrationTemplate, PytorchBackend };

export interface IntegrationGeneratorSchema {
  template: IntegrationTemplate;
  project?: string;
  directory?: string;
  backend?: PytorchBackend;
  includeNotebook?: boolean;
  includeDocker?: boolean;
  overwrite?: boolean;
  skipFormat?: boolean;
}
