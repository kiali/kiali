import { ActionType, createAction, createStandardAction } from 'typesafe-actions';
import { ActionKeys } from './ActionKeys';
import { Cluster } from '../types/Cluster';

export const ClusterActions = {
  toggleActiveCluster: createStandardAction(ActionKeys.TOGGLE_ACTIVE_CLUSTER)<Cluster>(),
  setActiveClusters: createStandardAction(ActionKeys.SET_ACTIVE_CLUSTERS)<Cluster[]>(),
  setFilter: createStandardAction(ActionKeys.CLUSTER_SET_FILTER)<string>(),
  requestStarted: createAction(ActionKeys.CLUSTER_REQUEST_STARTED),
  requestFailed: createAction(ActionKeys.CLUSTER_FAILED),
  receiveList: createAction(ActionKeys.CLUSTER_SUCCESS, resolve => (newList: Cluster[], receivedAt: Date) =>
    resolve({
      list: newList,
      receivedAt: receivedAt
    })
  )
};

export type ClusterAction = ActionType<typeof ClusterActions>;
