import { getType } from 'typesafe-actions';
import { updateState } from '../utils/Reducer';
import { ClusterState } from '../store/Store';
import { KialiAppAction } from '../actions/KialiAppAction';
import { ClusterActions } from '../actions/ClusterAction';
import { serverConfig } from '../config';

export const INITIAL_CLUSTER_STATE: ClusterState = {
  activeClusters: [],
  filter: ''
};

export const ClusterStateReducer = (
  state: ClusterState = INITIAL_CLUSTER_STATE,
  action: KialiAppAction
): ClusterState => {
  switch (action.type) {
    case getType(ClusterActions.toggleActiveCluster):
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

    case getType(ClusterActions.setActiveClusters):
      return updateState(state, { activeClusters: action.payload });

    case getType(ClusterActions.setFilter):
      return updateState(state, { filter: action.payload });

    default:
      return state;
  }
};
