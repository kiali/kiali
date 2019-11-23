// Action Creators allow us to create typesafe utilities for dispatching actions
import { ActionType, createAction, createStandardAction } from 'typesafe-actions';
import { GraphType, EdgeLabelMode } from '../types/Graph';
import { ActionKeys } from './ActionKeys';

export const GraphToolbarActions = {
  setEdgelLabelMode: createStandardAction(ActionKeys.GRAPH_TOOLBAR_SET_EDGE_LABEL_MODE)<EdgeLabelMode>(),
  setFindValue: createStandardAction(ActionKeys.GRAPH_TOOLBAR_SET_FIND_VALUE)<string>(),
  setGraphType: createStandardAction(ActionKeys.GRAPH_TOOLBAR_SET_GRAPH_TYPE)<GraphType>(),
  setHideValue: createStandardAction(ActionKeys.GRAPH_TOOLBAR_SET_HIDE_VALUE)<string>(),
  setShowUnusedNodes: createStandardAction(ActionKeys.GRAPH_TOOLBAR_SET_SHOW_UNUSED_NODES)<boolean>(),
  // Toggle actions
  toggleCompressOnHide: createAction(ActionKeys.GRAPH_TOOLBAR_TOGGLE_COMPRESS_ON_HIDE),
  toggleGraphNodeLabel: createAction(ActionKeys.GRAPH_TOOLBAR_TOGGLE_GRAPH_NODE_LABEL),
  toggleLegend: createAction(ActionKeys.GRAPH_TOOLBAR_TOGGLE_LEGEND),
  toggleGraphVirtualServices: createAction(ActionKeys.GRAPH_TOOLBAR_TOGGLE_GRAPH_VIRTUAL_SERVICES),
  toggleGraphCircuitBreakers: createAction(ActionKeys.GRAPH_TOOLBAR_TOGGLE_GRAPH_CIRCUIT_BREAKERS),
  toggleGraphMissingSidecars: createAction(ActionKeys.GRAPH_TOOLBAR_TOGGLE_GRAPH_MISSING_SIDECARS),
  toggleGraphSecurity: createAction(ActionKeys.GRAPH_TOOLBAR_TOGGLE_GRAPH_SECURITY),
  toggleFindHelp: createAction(ActionKeys.GRAPH_TOOLBAR_TOGGLE_FIND_HELP),
  toggleServiceNodes: createAction(ActionKeys.GRAPH_TOOLBAR_TOGGLE_SERVICE_NODES),
  toggleTrafficAnimation: createAction(ActionKeys.GRAPH_TOOLBAR_TOGGLE_TRAFFIC_ANIMATION),
  toggleUnusedNodes: createAction(ActionKeys.GRAPH_TOOLBAR_TOGGLE_UNUSED_NODES)
};

export type GraphToolbarAction = ActionType<typeof GraphToolbarActions>;
