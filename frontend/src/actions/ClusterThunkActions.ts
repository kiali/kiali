import type { KialiAppState } from '../store/Store';
import type { KialiDispatch } from '../types/Redux';
import { ClusterActions } from './ClusterAction';
import { NamespaceActions } from './NamespaceAction';
import { visibleClusterNames } from '../utils/ClusterUtils';

// Namespaces are selected by name, so a namespace survives only while some
// visible cluster still contains it. Nothing is pruned until the namespace list
// has been loaded, otherwise a slow load would wipe the selection.
const pruneActiveNamespaces = (dispatch: KialiDispatch, getState: () => KialiAppState): void => {
  const state = getState();
  const selection = state.clusters.selectedClusters;
  const namespaces = state.namespaces.namespaces;

  if (selection === undefined || namespaces.length === 0) {
    return;
  }

  const visible = new Set(visibleClusterNames(selection));
  const visibleNames = new Set(namespaces.filter(ns => !ns.cluster || visible.has(ns.cluster)).map(ns => ns.name));
  const activeNamespaces = state.namespaces.activeNamespaces;
  const pruned = activeNamespaces.filter(ns => visibleNames.has(ns.name));

  if (pruned.length !== activeNamespaces.length) {
    dispatch(NamespaceActions.setActiveNamespaces(pruned));
  }
};

export const ClusterThunkActions = {
  setSelectedClusters: (clusters: string[]) => {
    return (dispatch: KialiDispatch, getState: () => KialiAppState): void => {
      dispatch(ClusterActions.setSelectedClusters(clusters));
      pruneActiveNamespaces(dispatch, getState);
    };
  },

  toggleSelectedCluster: (cluster: string) => {
    return (dispatch: KialiDispatch, getState: () => KialiAppState): void => {
      dispatch(ClusterActions.toggleSelectedCluster(cluster));
      pruneActiveNamespaces(dispatch, getState);
    };
  }
};
