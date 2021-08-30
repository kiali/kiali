import { createSelector } from 'reselect';
import { KialiAppState } from './Store';
import { isMTLSEnabled } from '../types/TLSStatus';
import { TimeRange } from '../types/Common';
// These memoized selectors are from Redux Reselect package

type Selector<T> = (state: KialiAppState) => T;

const createIdentitySelector = <T extends unknown>(selector: Selector<T>): Selector<T> =>
  createSelector(selector, (x: T): T => x);

// select the proper field from Redux State
const activeNamespaces = (state: KialiAppState) => state.namespaces.activeNamespaces;

// Select from the above field(s) and the last function is the formatter
export const activeNamespacesSelector = createIdentitySelector(activeNamespaces);

const duration = (state: KialiAppState) => state.userSettings.duration;

export const durationSelector = createIdentitySelector(duration);

const timeRange = (state: KialiAppState): TimeRange => state.userSettings.timeRange;

export const timeRangeSelector = createIdentitySelector(timeRange);

const namespaceFilter = (state: KialiAppState) => state.namespaces.filter;

export const namespaceFilterSelector = createIdentitySelector(namespaceFilter);

const edgeLabels = (state: KialiAppState) => state.graph.toolbarState.edgeLabels;

export const edgeLabelsSelector = createIdentitySelector(edgeLabels);

const findValue = (state: KialiAppState) => state.graph.toolbarState.findValue;

export const findValueSelector = createIdentitySelector(findValue);

const graphType = (state: KialiAppState) => state.graph.toolbarState.graphType;

export const graphTypeSelector = createIdentitySelector(graphType);

const hideValue = (state: KialiAppState) => state.graph.toolbarState.hideValue;

export const hideValueSelector = createIdentitySelector(hideValue);

const namespaceItems = (state: KialiAppState) => state.namespaces.items;

export const namespaceItemsSelector = createIdentitySelector(namespaceItems);

const refreshInterval = (state: KialiAppState) => state.userSettings.refreshInterval;

export const refreshIntervalSelector = createIdentitySelector(refreshInterval);

const replayActive = (state: KialiAppState) => state.userSettings.replayActive;

export const replayActiveSelector = createIdentitySelector(replayActive);

const replayQueryTime = (state: KialiAppState) => state.userSettings.replayQueryTime;

export const replayQueryTimeSelector = createIdentitySelector(replayQueryTime);

const lastRefreshAt = (state: KialiAppState) => state.globalState.lastRefreshAt;

export const lastRefreshAtSelector = createIdentitySelector(lastRefreshAt);

const showIdleNodes = (state: KialiAppState) => state.graph.toolbarState.showIdleNodes;

export const showIdleNodesSelector = createIdentitySelector(showIdleNodes);

const trafficRates = (state: KialiAppState) => state.graph.toolbarState.trafficRates;

export const trafficRatesSelector = createIdentitySelector(trafficRates);

const meshwideMTLSStatus = (state: KialiAppState) => state.meshTLSStatus.status;

export const meshWideMTLSStatusSelector = createIdentitySelector(meshwideMTLSStatus);

const meshwideMTLSEnabled = (state: KialiAppState) => isMTLSEnabled(state.meshTLSStatus.status);

export const meshWideMTLSEnabledSelector = createIdentitySelector(meshwideMTLSEnabled);

const istioStatus = (state: KialiAppState) => state.istioStatus;

export const istioStatusSelector = createIdentitySelector(istioStatus);
