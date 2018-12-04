import { createSelector } from 'reselect';
import { KialiAppState } from './Store';
// These memoized selectors are from Redux Reselect package

// select the proper field from Redux State
const activeNamespaces = (state: KialiAppState) => state.namespaces.activeNamespaces;

// Select from the above field(s) and the last function is the formatter
export const activeNamespacesSelector = createSelector(
  activeNamespaces,
  namespaces => namespaces // identity function in this case, but as a Namespace[] type
);

/**
 * Gets a comma separated list of the namespaces for displaying
 * @type {OutputSelector<KialiAppState, any, (res: Namespace[]) => any>}
 */
export const activeNamespacesAsStringSelector = createSelector(
  activeNamespaces,
  namespaces => namespaces.map(namespace => namespace.name).join(', ')
);

const duration = (state: KialiAppState) => state.userSettings.duration;

export const durationSelector = createSelector(
  duration,
  x => x // identity function
);

const edgeLabelMode = (state: KialiAppState) => state.graph.filterState.edgeLabelMode;

export const edgeLabelModeSelector = createSelector(
  edgeLabelMode,
  x => x // identity function
);

const graphType = (state: KialiAppState) => state.graph.filterState.graphType;

export const graphTypeSelector = createSelector(
  graphType,
  x => x // identity function
);

const namespaceItems = (state: KialiAppState) => state.namespaces.items;

export const namespaceItemsSelector = createSelector(
  namespaceItems,
  x => x // identity function
);

const refreshInterval = (state: KialiAppState) => state.userSettings.refreshInterval;

export const refreshIntervalSelector = createSelector(
  refreshInterval,
  x => x // identity function
);

const showServiceNodes = (state: KialiAppState) => state.graph.filterState.showServiceNodes;

export const showServiceNodesSelector = createSelector(
  showServiceNodes,
  x => x // identity function
);
