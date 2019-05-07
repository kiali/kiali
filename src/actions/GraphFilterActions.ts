// Action Creators allow us to create typesafe utilities for dispatching actions
import { ActionType, createAction, createStandardAction } from 'typesafe-actions';
import { GraphType } from '../types/Graph';
import { EdgeLabelMode } from '../types/GraphFilter';

enum GraphFilterActionKeys {
  SET_EDGE_LABEL_MODE = 'SET_EDGE_LABEL_MODE',
  SET_FIND_VALUE = 'SET_FIND_VALUE',
  SET_GRAPH_TYPE = 'SET_GRAPH_TYPE',
  SET_HIDE_VALUE = 'SET_HIDE_VALUE',
  SET_SHOW_UNUSED_NODES = 'SET_SHOW_UNUSED_NODES',
  // Toggle Actions
  TOGGLE_GRAPH_NODE_LABEL = 'TOGGLE_GRAPH_NODE_LABEL',
  TOGGLE_GRAPH_CIRCUIT_BREAKERS = 'TOGGLE_GRAPH_CIRCUIT_BREAKERS',
  TOGGLE_GRAPH_VIRTUAL_SERVICES = 'TOGGLE_GRAPH_VIRTUAL_SERVICES',
  TOGGLE_GRAPH_MISSING_SIDECARS = 'TOGGLE_GRAPH_MISSING_SIDECARS',
  TOGGLE_GRAPH_SECURITY = 'TOGGLE_GRAPH_SECURITY',
  TOGGLE_LEGEND = 'TOGGLE_LEGEND',
  TOGGLE_FIND_HELP = 'TOGGLE_FIND_HELP',
  TOGGLE_SERVICE_NODES = 'TOGGLE_SERVICE_NODES',
  TOGGLE_TRAFFIC_ANIMATION = 'TOGGLE_TRAFFIC_ANIMATION',
  TOGGLE_UNUSED_NODES = 'TOGGLE_UNUSED_NODES',
  // Disable Actions
  ENABLE_GRAPH_FILTERS = 'ENABLE_GRAPH_FILTERS'
}

export const GraphFilterActions = {
  setEdgelLabelMode: createStandardAction(GraphFilterActionKeys.SET_EDGE_LABEL_MODE)<EdgeLabelMode>(),
  setFindValue: createStandardAction(GraphFilterActionKeys.SET_FIND_VALUE)<string>(),
  setGraphType: createStandardAction(GraphFilterActionKeys.SET_GRAPH_TYPE)<GraphType>(),
  setHideValue: createStandardAction(GraphFilterActionKeys.SET_HIDE_VALUE)<string>(),
  setShowUnusedNodes: createStandardAction(GraphFilterActionKeys.SET_SHOW_UNUSED_NODES)<boolean>(),
  // Toggle actions
  showGraphFilters: createStandardAction(GraphFilterActionKeys.ENABLE_GRAPH_FILTERS)<boolean>(),
  toggleGraphNodeLabel: createAction(GraphFilterActionKeys.TOGGLE_GRAPH_NODE_LABEL),
  toggleLegend: createAction(GraphFilterActionKeys.TOGGLE_LEGEND),
  toggleGraphVirtualServices: createAction(GraphFilterActionKeys.TOGGLE_GRAPH_VIRTUAL_SERVICES),
  toggleGraphCircuitBreakers: createAction(GraphFilterActionKeys.TOGGLE_GRAPH_CIRCUIT_BREAKERS),
  toggleGraphMissingSidecars: createAction(GraphFilterActionKeys.TOGGLE_GRAPH_MISSING_SIDECARS),
  toggleGraphSecurity: createAction(GraphFilterActionKeys.TOGGLE_GRAPH_SECURITY),
  toggleFindHelp: createAction(GraphFilterActionKeys.TOGGLE_FIND_HELP),
  toggleServiceNodes: createAction(GraphFilterActionKeys.TOGGLE_SERVICE_NODES),
  toggleTrafficAnimation: createAction(GraphFilterActionKeys.TOGGLE_TRAFFIC_ANIMATION),
  toggleUnusedNodes: createAction(GraphFilterActionKeys.TOGGLE_UNUSED_NODES)
};

export type GraphFilterAction = ActionType<typeof GraphFilterActions>;
