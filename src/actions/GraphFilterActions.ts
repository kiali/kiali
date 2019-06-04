// Action Creators allow us to create typesafe utilities for dispatching actions
import { ActionType, createAction, createStandardAction } from 'typesafe-actions';
import { GraphType } from '../types/Graph';
import { EdgeLabelMode } from '../types/GraphFilter';
import { ActionKeys } from './ActionKeys';

export const GraphFilterActions = {
  setEdgelLabelMode: createStandardAction(ActionKeys.GRAPH_FILTER_SET_EDGE_LABEL_MODE)<EdgeLabelMode>(),
  setFindValue: createStandardAction(ActionKeys.GRAPH_FILTER_SET_FIND_VALUE)<string>(),
  setGraphType: createStandardAction(ActionKeys.GRAPH_FILTER_SET_GRAPH_TYPE)<GraphType>(),
  setHideValue: createStandardAction(ActionKeys.GRAPH_FILTER_SET_HIDE_VALUE)<string>(),
  setShowUnusedNodes: createStandardAction(ActionKeys.GRAPH_FILTER_SET_SHOW_UNUSED_NODES)<boolean>(),
  // Toggle actions
  showGraphFilters: createStandardAction(ActionKeys.ENABLE_GRAPH_FILTERS)<boolean>(),
  toggleGraphNodeLabel: createAction(ActionKeys.GRAPH_FILTER_TOGGLE_GRAPH_NODE_LABEL),
  toggleLegend: createAction(ActionKeys.GRAPH_FILTER_TOGGLE_LEGEND),
  toggleGraphVirtualServices: createAction(ActionKeys.GRAPH_FILTER_TOGGLE_GRAPH_VIRTUAL_SERVICES),
  toggleGraphCircuitBreakers: createAction(ActionKeys.GRAPH_FILTER_TOGGLE_GRAPH_CIRCUIT_BREAKERS),
  toggleGraphMissingSidecars: createAction(ActionKeys.GRAPH_FILTER_TOGGLE_GRAPH_MISSING_SIDECARS),
  toggleGraphSecurity: createAction(ActionKeys.GRAPH_FILTER_TOGGLE_GRAPH_SECURITY),
  toggleFindHelp: createAction(ActionKeys.GRAPH_FILTER_TOGGLE_FIND_HELP),
  toggleServiceNodes: createAction(ActionKeys.GRAPH_FILTER_TOGGLE_SERVICE_NODES),
  toggleTrafficAnimation: createAction(ActionKeys.GRAPH_FILTER_TOGGLE_TRAFFIC_ANIMATION),
  toggleUnusedNodes: createAction(ActionKeys.GRAPH_FILTER_TOGGLE_UNUSED_NODES)
};

export type GraphFilterAction = ActionType<typeof GraphFilterActions>;
