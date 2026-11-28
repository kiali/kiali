import type { KialiAppState } from './Store';
import type { TimeRange } from '../types/Common';
import type { Namespace } from '../types/Namespace';
import type { MeshCluster } from '../types/Mesh';
import type { EdgeLabelMode, EdgeMode, GraphType, TrafficRate } from '../types/Graph';
import type { ComponentStatus } from '../types/IstioStatus';
import type { ClusterSelection } from '../utils/ClusterUtils';
import { visibleClusterNames } from '../utils/ClusterUtils';

export const activeNamespacesSelector = (state: KialiAppState): Namespace[] => state.namespaces.activeNamespaces;

// The namespace list is already grouped per cluster, but the cluster selection
// hides the groups of the clusters that are currently filtered out.
export const namespacesPerClusterSelector = (state: KialiAppState): Map<string, string[]> => {
  const perCluster = state.namespaces.namespacesPerCluster;
  const selection = state.clusters.selectedClusters;

  if (selection === undefined) {
    return perCluster;
  }

  const visible = new Set(visibleClusterNames(selection));
  const filtered = new Map<string, string[]>();

  perCluster.forEach((namespaces, cluster) => {
    if (visible.has(cluster)) {
      filtered.set(cluster, namespaces);
    }
  });

  return filtered;
};

export const selectedClustersSelector = (state: KialiAppState): ClusterSelection => state.clusters.selectedClusters;

// The explicit selection resolved against the clusters reported by the backend.
// Undefined means "everything", an empty list means "nothing", so this is both
// the list to fetch from and the list to filter rendered data with.
export const visibleClustersSelector = (state: KialiAppState): string[] =>
  visibleClusterNames(state.clusters.selectedClusters);

export const activeClustersSelector = (state: KialiAppState): MeshCluster[] => state.clusters.activeClusters;

export const durationSelector = (state: KialiAppState): number => state.userSettings.duration;

export const timeRangeSelector = (state: KialiAppState): TimeRange => state.userSettings.timeRange;

export const namespaceFilterSelector = (state: KialiAppState): string => state.namespaces.filter;

export const clusterFilterSelector = (state: KialiAppState): string => state.clusters.filter;

export const edgeLabelsSelector = (state: KialiAppState): EdgeLabelMode[] => state.graph.toolbarState.edgeLabels;

export const edgeModeSelector = (state: KialiAppState): EdgeMode => state.graph.edgeMode;

export const findValueSelector = (state: KialiAppState): string => state.graph.toolbarState.findValue;

export const graphTypeSelector = (state: KialiAppState): GraphType => state.graph.toolbarState.graphType;

export const hideValueSelector = (state: KialiAppState): string => state.graph.toolbarState.hideValue;

export const meshFindValueSelector = (state: KialiAppState): string => state.mesh.toolbarState.findValue;

export const meshHideValueSelector = (state: KialiAppState): string => state.mesh.toolbarState.hideValue;

// "items" holds one entry per namespace name, so it cannot tell which cluster
// the namespace came from. When a cluster selection is active we rebuild the
// list from "namespaces" (which carries the cluster) and dedupe it by name.
export const namespaceItemsSelector = (state: KialiAppState): Namespace[] | undefined => {
  const selection = state.clusters.selectedClusters;

  if (selection === undefined) {
    return state.namespaces.items;
  }

  const visible = new Set(visibleClusterNames(selection));
  const byName = new Map<string, Namespace>();

  state.namespaces.namespaces.forEach(ns => {
    if (ns.cluster === undefined || visible.has(ns.cluster)) {
      byName.set(ns.name, ns);
    }
  });

  return Array.from(byName.values());
};

export const refreshIntervalSelector = (state: KialiAppState): number => state.userSettings.refreshInterval;

export const replayActiveSelector = (state: KialiAppState): boolean => state.userSettings.replayActive;

export const replayQueryTimeSelector = (state: KialiAppState): number => state.userSettings.replayQueryTime;

export const showIdleNodesSelector = (state: KialiAppState): boolean => state.graph.toolbarState.showIdleNodes;

export const trafficRatesSelector = (state: KialiAppState): TrafficRate[] => state.graph.toolbarState.trafficRates;

export const meshWideMTLSStatusSelector = (state: KialiAppState): string => state.meshTLSStatus.status;

export const minTLSVersionSelector = (state: KialiAppState): string => state.meshTLSStatus.minTLS;

export const meshWideMTLSEnabledSelector = (state: KialiAppState): boolean => state.meshTLSStatus.autoMTLSEnabled;

export const istioStatusSelector = (state: KialiAppState): { [cluster: string]: ComponentStatus[] } =>
  state.istioStatus;

export const languageSelector = (state: KialiAppState): string => state.globalState.language;
