import { createSelector } from 'reselect';
import * as GraphData from './Selectors/GraphData';
import { KialiAppState } from './Store';
import { isMTLSEnabled } from '../types/TLSStatus';
// These memoized selectors are from Redux Reselect package

type Selector<T> = (state: KialiAppState) => T;

const createIdentitySelector = <T extends unknown>(selector: Selector<T>): Selector<T> =>
  createSelector(
    selector,
    (x: T): T => x
  );

// select the proper field from Redux State
const activeNamespaces = (state: KialiAppState) => state.namespaces.activeNamespaces;

// Select from the above field(s) and the last function is the formatter
export const activeNamespacesSelector = createIdentitySelector(activeNamespaces);

const duration = (state: KialiAppState) => state.userSettings.duration;

export const durationSelector = createIdentitySelector(duration);

const namespaceFilter = (state: KialiAppState) => state.namespaces.filter;

export const namespaceFilterSelector = createIdentitySelector(namespaceFilter);

const edgeLabelMode = (state: KialiAppState) => state.graph.toolbarState.edgeLabelMode;

export const edgeLabelModeSelector = createIdentitySelector(edgeLabelMode);

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

const replayWindow = (state: KialiAppState) => state.userSettings.replayWindow;

export const replayWindowSelector = createIdentitySelector(replayWindow);

const replayQueryTime = (state: KialiAppState) => state.userSettings.replayQueryTime;

export const replayQueryTimeSelector = createIdentitySelector(replayQueryTime);

const lastRefreshAt = (state: KialiAppState) => state.globalState.lastRefreshAt;

export const lastRefreshAtSelector = createIdentitySelector(lastRefreshAt);

const showUnusedNodes = (state: KialiAppState) => state.graph.toolbarState.showUnusedNodes;

export const showUnusedNodesSelector = createIdentitySelector(showUnusedNodes);

export const graphDataSelector = GraphData.graphDataSelector;

const meshwideMTLSStatus = (state: KialiAppState) => state.meshTLSStatus.status;

export const meshWideMTLSStatusSelector = createIdentitySelector(meshwideMTLSStatus);

const meshwideMTLSEnabled = (state: KialiAppState) => isMTLSEnabled(state.meshTLSStatus.status);

export const meshWideMTLSEnabledSelector = createIdentitySelector(meshwideMTLSEnabled);
