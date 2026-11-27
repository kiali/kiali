import type { KialiAppState } from './Store';
import type { TimeRange } from '../types/Common';
import type { Namespace } from '../types/Namespace';
import type { MeshCluster } from '../types/Mesh';
import type { EdgeLabelMode, EdgeMode, GraphType, TrafficRate } from '../types/Graph';
import type { ComponentStatus } from '../types/IstioStatus';

export const activeNamespacesSelector = (state: KialiAppState): Namespace[] => state.namespaces.activeNamespaces;

export const namespacesPerClusterSelector = (state: KialiAppState): Map<string, string[]> =>
  state.namespaces.namespacesPerCluster;

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

export const namespaceItemsSelector = (state: KialiAppState): Namespace[] | undefined => state.namespaces.items;

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
