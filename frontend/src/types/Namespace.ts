export interface Namespace {
  name: string;
  cluster?: string;
  isAmbient?: boolean;
  labels?: { [key: string]: string };
  annotations?: { [key: string]: string };
  revision?: string;
}

export const namespaceFromString = (namespace: string) => ({ name: namespace });

export const namespacesFromString = (namespaces: string) => {
  return namespaces.split(',').map(name => namespaceFromString(name));
};

export const namespacesToString = (namespaces: Namespace[]) => namespaces.map(namespace => namespace.name).join(',');
