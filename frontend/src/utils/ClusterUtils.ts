import { serverConfig } from 'config/ServerConfig';

type ClusterAware = { cluster?: string };

/**
 * The global cluster selection. "undefined" means the user never filtered, so
 * everything stays visible; an explicit list - including an empty one - is
 * taken literally. That lets the selector reach the "no clusters" state instead
 * of the last deselection silently re-enabling every cluster.
 */
export type ClusterSelection = string[] | undefined;

/** Every cluster known to Kiali, as reported by the backend config. */
export const allClusterNames = (): string[] => Object.keys(serverConfig.clusters);

/**
 * An undefined cluster means the resource is not cluster scoped, hence visible.
 */
export const isClusterVisible = (selectedClusters: ClusterSelection, cluster?: string): boolean => {
  if (selectedClusters === undefined || cluster === undefined) {
    return true;
  }

  return selectedClusters.includes(cluster);
};

/**
 * Keeps the stored selection canonical: unknown clusters are dropped, duplicates
 * removed, and "every cluster" collapses back to undefined (the unfiltered state).
 */
export const normalizeSelectedClusters = (clusters: string[]): ClusterSelection => {
  const all = allClusterNames();
  const unique = Array.from(new Set(clusters.filter(cluster => all.includes(cluster))));

  return unique.length > 0 && unique.length === all.length ? undefined : unique;
};

/** The clusters currently displayed, resolved to real cluster names. */
export const visibleClusterNames = (selectedClusters: ClusterSelection): string[] => {
  const all = allClusterNames();

  return selectedClusters === undefined ? all : all.filter(cluster => selectedClusters.includes(cluster));
};

/** Namespaces belonging to the visible clusters, in their original order. */
export const filterBySelectedClusters = <T extends ClusterAware>(
  items: T[],
  selectedClusters: ClusterSelection
): T[] => {
  if (selectedClusters === undefined) {
    return items;
  }

  return items.filter(item => isClusterVisible(selectedClusters, item.cluster));
};
