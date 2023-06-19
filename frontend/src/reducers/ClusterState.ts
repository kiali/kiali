import { getType } from 'typesafe-actions';
import { updateState } from '../utils/Reducer';
import { ClusterState } from '../store/Store';
import { KialiAppAction } from '../actions/KialiAppAction';
import { ClusterActions } from '../actions/ClusterAction';
import { Namespace } from '../types/Namespace';
import { Cluster } from '../types/Cluster';

export function filterDuplicateClusters(namespaces?: Namespace[]): Cluster[] {
  const clMap = new Map<string, Cluster>();
  namespaces?.forEach(ns => {
    if (ns.cluster) {
      clMap.set(ns.cluster, { name: ns.cluster });
    }
  });
  return Array.from(clMap.values());
}

export const INITIAL_CLUSTER_STATE: ClusterState = {
  activeClusters: [],
  isFetching: false,
  items: [],
  lastUpdated: undefined,
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
          activeClusters: [...state.activeClusters, { name: action.payload.name }]
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

    case getType(ClusterActions.requestStarted):
      return updateState(state, {
        isFetching: true
      });

    case getType(ClusterActions.receiveList):
      const names = action.payload.list.map(cl => cl.name);
      const validActive = state.activeClusters.filter(ac => names.includes(ac.name));
      let updatedActive = {};
      if (state.activeClusters.length !== validActive.length) {
        updatedActive = { activeClusters: validActive };
      }
      return updateState(state, {
        isFetching: false,
        items: action.payload.list,
        lastUpdated: action.payload.receivedAt,
        ...updatedActive
      });

    case getType(ClusterActions.requestFailed):
      return updateState(state, {
        isFetching: false
      });

    default:
      return state;
  }
};
