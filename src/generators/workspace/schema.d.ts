import { InferencePreset } from '../shared';

export interface WorkspaceGeneratorSchema {
  name?: string;
  membersGlob?: string;
  exclude?: string;
  targetPrefix?: string;
  inferencePreset?: InferencePreset;
  includeGlobalTargets?: boolean;
  skipFormat?: boolean;
}
