import { Namespace } from '../types/Namespace';

export const removeDuplicatesArray = (a: string[]): string[] => [...Array.from(new Set(a))] as string[];

export const arrayEquals = <T>(a1: T[], a2: T[], comparator: (v1: T, v2: T) => boolean): boolean => {
  if (a1.length !== a2.length) {
    return false;
  }
  for (let i = 0; i < a1.length; ++i) {
    if (!comparator(a1[i], a2[i])) {
      return false;
    }
  }
  return true;
};

export const namespaceEquals = (ns1: Namespace[], ns2: Namespace[]): boolean =>
  arrayEquals(ns1, ns2, (n1, n2) => n1.name === n2.name);

export const namespacesPerCluster = (
  activeNss: Namespace[],
  allNss: Namespace[] | undefined,
  cluster: string
): string[] => {
  const activeNames = new Set(activeNss.map(ns => ns.name));
  if (!allNss) {
    return activeNss.map(ns => ns.name);
  }

  // filter allNss for namespaces that match the selected active names and the cluster
  return removeDuplicatesArray(
    allNss.filter(ns => activeNames.has(ns.name) && ns.cluster === cluster).map(ns => ns.name)
  );
};

export function groupBy<T>(items: T[], key: keyof T): { [key: string]: T[] } {
  return items.reduce(
    (result, item) => ({
      ...result,
      [item[key as string]]: [...(result[item[key as string]] || []), item]
    }),
    {} as { [key: string]: T[] }
  );
}

export type validationType = 'success' | 'warning' | 'error' | 'default';
export const isValid = (isValid?: boolean, isWarning?: boolean): validationType => {
  if (isValid === undefined) {
    return 'default';
  }
  if (isValid) {
    return 'success';
  }
  return isWarning ? 'warning' : 'error';
};

export const download = (text: string, fileName: string): void => {
  const element = document.createElement('a');
  const file = new Blob([text], { type: 'text/plain' });
  element.href = URL.createObjectURL(file);
  element.download = fileName;
  document.body.appendChild(element); // Required for this to work in FireFox
  element.click();
};
