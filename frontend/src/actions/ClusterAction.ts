import type { ActionType } from 'types/typesafeActionsLegacy';
import { createStandardAction } from 'types/typesafeActionsLegacy';
import { ActionKeys } from './ActionKeys';
import type { MeshCluster } from '../types/Mesh';

export const ClusterActions = {
  setActiveClusters: createStandardAction(ActionKeys.SET_ACTIVE_CLUSTERS)<MeshCluster[]>(),
  setFilter: createStandardAction(ActionKeys.CLUSTER_SET_FILTER)<string>(),
  setSelectedClusters: createStandardAction(ActionKeys.SET_SELECTED_CLUSTERS)<string[]>(),
  toggleActiveCluster: createStandardAction(ActionKeys.TOGGLE_ACTIVE_CLUSTER)<MeshCluster>(),
  toggleSelectedCluster: createStandardAction(ActionKeys.TOGGLE_SELECTED_CLUSTER)<string>()
};

export type ClusterAction = ActionType<typeof ClusterActions>;
