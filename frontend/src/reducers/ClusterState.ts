import { getType } from 'types/typesafeActionsLegacy';
import { updateState } from '../utils/Reducer';
import type { ClusterState } from '../store/Store';
import type { KialiAppAction } from '../actions/KialiAppAction';
import { ClusterActions } from '../actions/ClusterAction';
import { serverConfig } from '../config';
import type { ClusterSelection } from '../utils/ClusterUtils';
import { allClusterNames, normalizeSelectedClusters } from '../utils/ClusterUtils';

export const INITIAL_CLUSTER_STATE: ClusterState = {
  activeClusters: [],
  filter: '',
  selectedClusters: undefined
};

/**
 * The global cluster selection treats an undefined list as "every cluster". To
 * toggle a single cluster we materialize that implicit selection first; removing
 * the last cluster leaves an explicit empty list, which hides everything.
 */
const toggleCluster = (selectedClusters: ClusterSelection, cluster: string): ClusterSelection => {
  const current = selectedClusters ?? allClusterNames();

  return normalizeSelectedClusters(
    current.includes(cluster) ? current.filter(name => name !== cluster) : [...current, cluster]
  );
};

export const ClusterStateReducer = (
  state: ClusterState = INITIAL_CLUSTER_STATE,
  action: KialiAppAction
): ClusterState => {
  switch (action.type) {
    case getType(ClusterActions.toggleActiveCluster): {
      const clusterIndex = state.activeClusters.findIndex(cluster => cluster.name === action.payload.name);
      if (clusterIndex === -1) {
        return updateState(state, {
          activeClusters: [...state.activeClusters, serverConfig.clusters[action.payload.name]]
        });
      } else {
        const activeClusters = [...state.activeClusters];
        activeClusters.splice(clusterIndex, 1);
        return updateState(state, { activeClusters });
      }
    }

    case getType(ClusterActions.setActiveClusters):
      return updateState(state, { activeClusters: action.payload });

    case getType(ClusterActions.setFilter):
      return updateState(state, { filter: action.payload });

    case getType(ClusterActions.setSelectedClusters):
      return updateState(state, { selectedClusters: normalizeSelectedClusters(action.payload) });

    case getType(ClusterActions.toggleSelectedCluster):
      return updateState(state, { selectedClusters: toggleCluster(state.selectedClusters, action.payload) });

    default:
      return state;
  }
};
