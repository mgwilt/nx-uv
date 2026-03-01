export type PythonProjectType = 'app' | 'lib' | 'script';

export interface ProjectGeneratorSchema {
  name: string;
  directory?: string;
  moduleName?: string;
  projectType?: PythonProjectType;
  withTests?: boolean;
  workspaceMember?: boolean;
  tags?: string;
  skipFormat?: boolean;
}
