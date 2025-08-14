export interface Namespace {
  annotations?: { [key: string]: string };
  cluster?: string;
  isAmbient?: boolean;
  isControlPlane?: boolean;
  labels?: { [key: string]: string };
  name: string;
  revision?: string;
}

export const namespaceFromString = (namespace: string): { name: string } => ({ name: namespace });

export const namespacesFromString = (namespaces: string): { name: string }[] => {
  return namespaces.split(',').map(name => namespaceFromString(name));
};

export const namespacesToString = (namespaces: Namespace[]): string =>
  namespaces.map(namespace => namespace.name).join(',');
