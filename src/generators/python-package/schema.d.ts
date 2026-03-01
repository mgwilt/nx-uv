export interface PythonPackageGeneratorSchema {
  name: string;
  directory?: string;
  moduleName?: string;
  withTests?: boolean;
  tags?: string;
}
