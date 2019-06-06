export default interface Namespace {
  name: string;
}

export const namespaceFromString = (namespace: string) => ({ name: namespace });

export const namespacesFromString = (namespaces: string) => {
  return namespaces.split(',').map(name => namespaceFromString(name));
};

export const namespacesToString = (namespaces: Namespace[]) => namespaces.map(namespace => namespace.name).join(',');
