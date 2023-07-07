import { ActionType, createStandardAction } from 'typesafe-actions';
import { ActionKeys } from './ActionKeys';
import { MeshCluster } from '../types/Mesh';

export const ClusterActions = {
  toggleActiveCluster: createStandardAction(ActionKeys.TOGGLE_ACTIVE_CLUSTER)<MeshCluster>(),
  setActiveClusters: createStandardAction(ActionKeys.SET_ACTIVE_CLUSTERS)<MeshCluster[]>(),
  setFilter: createStandardAction(ActionKeys.CLUSTER_SET_FILTER)<string>()
};

export type ClusterAction = ActionType<typeof ClusterActions>;
