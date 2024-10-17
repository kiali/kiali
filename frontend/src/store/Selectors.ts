import { createSelector } from 'reselect';
import { KialiAppState } from './Store';
import { TimeRange } from '../types/Common';
import { Namespace } from '../types/Namespace';
import { MeshCluster } from '../types/Mesh';
import { EdgeLabelMode, EdgeMode, GraphType, RankMode, TrafficRate } from '../types/Graph';
import { ComponentStatus } from '../types/IstioStatus';
import { CertsInfo } from '../types/CertsInfo';
// These memoized selectors are from Redux Reselect package

type Selector<T> = (state: KialiAppState) => T;

const createIdentitySelector = <T extends unknown>(selector: Selector<T>): Selector<T> =>
  createSelector(selector, (x: T): T => x);

// select the proper field from Redux State
const activeNamespaces = (state: KialiAppState): Namespace[] => state.namespaces.activeNamespaces;

// Select from the above field(s) and the last function is the formatter
export const activeNamespacesSelector = createIdentitySelector(activeNamespaces);

// select the proper field from Redux State
const namespacesPerCluster = (state: KialiAppState): Map<string, string[]> => state.namespaces.namespacesPerCluster;

// Select from the above field(s) and the last function is the formatter
export const namespacesPerClusterSelector = createIdentitySelector(namespacesPerCluster);

// select the proper field from Redux State
const activeClusters = (state: KialiAppState): MeshCluster[] => state.clusters.activeClusters;

// Select from the above field(s) and the last function is the formatter
export const activeClustersSelector = createIdentitySelector(activeClusters);

const duration = (state: KialiAppState): number => state.userSettings.duration;

export const durationSelector = createIdentitySelector(duration);

const timeRange = (state: KialiAppState): TimeRange => state.userSettings.timeRange;

export const timeRangeSelector = createIdentitySelector(timeRange);

const namespaceFilter = (state: KialiAppState): string => state.namespaces.filter;

export const namespaceFilterSelector = createIdentitySelector(namespaceFilter);

const clusterFilter = (state: KialiAppState): string => state.clusters.filter;

export const clusterFilterSelector = createIdentitySelector(clusterFilter);

const edgeLabels = (state: KialiAppState): EdgeLabelMode[] => state.graph.toolbarState.edgeLabels;

export const edgeLabelsSelector = createIdentitySelector(edgeLabels);

const edgeMode = (state: KialiAppState): EdgeMode => state.graph.edgeMode;

export const edgeModeSelector = createIdentitySelector(edgeMode);

const findValue = (state: KialiAppState): string => state.graph.toolbarState.findValue;

export const findValueSelector = createIdentitySelector(findValue);

const graphType = (state: KialiAppState): GraphType => state.graph.toolbarState.graphType;

export const graphTypeSelector = createIdentitySelector(graphType);

const hideValue = (state: KialiAppState): string => state.graph.toolbarState.hideValue;

export const hideValueSelector = createIdentitySelector(hideValue);

const meshFindValue = (state: KialiAppState): string => state.mesh.toolbarState.findValue;

export const meshFindValueSelector = createIdentitySelector(meshFindValue);

const meshHideValue = (state: KialiAppState): string => state.mesh.toolbarState.hideValue;

export const meshHideValueSelector = createIdentitySelector(meshHideValue);

const namespaceItems = (state: KialiAppState): Namespace[] | undefined => state.namespaces.items;

export const namespaceItemsSelector = createIdentitySelector(namespaceItems);

const rankBy = (state: KialiAppState): RankMode[] => state.graph.toolbarState.rankBy;

export const rankBySelector = createIdentitySelector(rankBy);

const refreshInterval = (state: KialiAppState): number => state.userSettings.refreshInterval;

export const refreshIntervalSelector = createIdentitySelector(refreshInterval);

const replayActive = (state: KialiAppState): boolean => state.userSettings.replayActive;

export const replayActiveSelector = createIdentitySelector(replayActive);

const replayQueryTime = (state: KialiAppState): number => state.userSettings.replayQueryTime;

export const replayQueryTimeSelector = createIdentitySelector(replayQueryTime);

const showIdleNodes = (state: KialiAppState): boolean => state.graph.toolbarState.showIdleNodes;

export const showIdleNodesSelector = createIdentitySelector(showIdleNodes);

const trafficRates = (state: KialiAppState): TrafficRate[] => state.graph.toolbarState.trafficRates;

export const trafficRatesSelector = createIdentitySelector(trafficRates);

const meshwideMTLSStatus = (state: KialiAppState): string => state.meshTLSStatus.status;

export const meshWideMTLSStatusSelector = createIdentitySelector(meshwideMTLSStatus);

const minTLSVersion = (state: KialiAppState): string => state.meshTLSStatus.minTLS;

export const minTLSVersionSelector = createIdentitySelector(minTLSVersion);

const meshwideMTLSEnabled = (state: KialiAppState): boolean => state.meshTLSStatus.autoMTLSEnabled;

export const meshWideMTLSEnabledSelector = createIdentitySelector(meshwideMTLSEnabled);

const istioStatus = (state: KialiAppState): ComponentStatus[] => state.istioStatus;

export const istioStatusSelector = createIdentitySelector(istioStatus);

const istioCertsInfo = (state: KialiAppState): CertsInfo[] => state.istioCertsInfo;

export const istioCertsInfoSelector = createIdentitySelector(istioCertsInfo);

const language = (state: KialiAppState): string => state.globalState.language;

export const languageSelector = createIdentitySelector(language);
