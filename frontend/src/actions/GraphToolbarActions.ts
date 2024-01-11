// Action Creators allow us to create typesafe utilities for dispatching actions
import { ActionType, createAction, createStandardAction } from 'typesafe-actions';
import { GraphType, EdgeLabelMode, TrafficRate, RankMode } from '../types/Graph';
import { ActionKeys } from './ActionKeys';

export const GraphToolbarActions = {
  resetSettings: createAction(ActionKeys.GRAPH_TOOLBAR_RESET_SETTINGS),
  setEdgeLabels: createStandardAction(ActionKeys.GRAPH_TOOLBAR_SET_EDGE_LABELS)<EdgeLabelMode[]>(),
  setFindValue: createStandardAction(ActionKeys.GRAPH_TOOLBAR_SET_FIND_VALUE)<string>(),
  setGraphType: createStandardAction(ActionKeys.GRAPH_TOOLBAR_SET_GRAPH_TYPE)<GraphType>(),
  setHideValue: createStandardAction(ActionKeys.GRAPH_TOOLBAR_SET_HIDE_VALUE)<string>(),
  setIdleNodes: createStandardAction(ActionKeys.GRAPH_TOOLBAR_SET_IDLE_NODES)<boolean>(),
  setRankBy: createStandardAction(ActionKeys.GRAPH_TOOLBAR_SET_RANK_BY)<RankMode[]>(),
  setTrafficRates: createStandardAction(ActionKeys.GRAPH_TOOLBAR_SET_TRAFFIC_RATES)<TrafficRate[]>(),
  // Toggle actions
  toggleBoxByCluster: createAction(ActionKeys.GRAPH_TOOLBAR_TOGGLE_BOX_BY_CLUSTER),
  toggleBoxByNamespace: createAction(ActionKeys.GRAPH_TOOLBAR_TOGGLE_BOX_BY_NAMESPACE),
  toggleCompressOnHide: createAction(ActionKeys.GRAPH_TOOLBAR_TOGGLE_COMPRESS_ON_HIDE),
  toggleLegend: createAction(ActionKeys.GRAPH_TOOLBAR_TOGGLE_LEGEND),
  toggleGraphVirtualServices: createAction(ActionKeys.GRAPH_TOOLBAR_TOGGLE_GRAPH_VIRTUAL_SERVICES),
  toggleGraphMissingSidecars: createAction(ActionKeys.GRAPH_TOOLBAR_TOGGLE_GRAPH_MISSING_SIDECARS),
  toggleGraphSecurity: createAction(ActionKeys.GRAPH_TOOLBAR_TOGGLE_GRAPH_SECURITY),
  toggleFindHelp: createAction(ActionKeys.GRAPH_TOOLBAR_TOGGLE_FIND_HELP),
  toggleIdleEdges: createAction(ActionKeys.GRAPH_TOOLBAR_TOGGLE_IDLE_EDGES),
  toggleIdleNodes: createAction(ActionKeys.GRAPH_TOOLBAR_TOGGLE_IDLE_NODES),
  toggleOperationNodes: createAction(ActionKeys.GRAPH_TOOLBAR_TOGGLE_OPERATION_NODES),
  toggleRank: createAction(ActionKeys.GRAPH_TOOLBAR_TOGGLE_RANK),
  toggleServiceNodes: createAction(ActionKeys.GRAPH_TOOLBAR_TOGGLE_SERVICE_NODES),
  toggleTrafficAnimation: createAction(ActionKeys.GRAPH_TOOLBAR_TOGGLE_TRAFFIC_ANIMATION),
  toggleWaypoints: createAction(ActionKeys.GRAPH_TOOLBAR_TOGGLE_WAYPOINT)
};

export type GraphToolbarAction = ActionType<typeof GraphToolbarActions>;
