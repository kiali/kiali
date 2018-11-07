import { createSelector } from 'reselect';
import { KialiAppState } from './Store';
// These memoized selectors are from Redux Reselect package

// select the proper field from Redux State
const activeNamespace = (state: KialiAppState) => state.namespaces.activeNamespace;

// Select from the above field(s) and the last function is the formatter
export const activeNamespaceSelector = createSelector(
  activeNamespace,
  namespace => namespace // identity function in this case, but as a Namespace type
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

const duration = (state: KialiAppState) => state.userSettings.duration;

export const durationSelector = createSelector(
  duration,
  x => x // identity function
);
