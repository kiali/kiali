// Action Creators allow us to create typesafe utilities for dispatching actions
import { createAction } from 'typesafe-actions';
import { EdgeLabelMode } from '../types/GraphFilter';

export enum GraphFilterActionKeys {
  // Toggle Actions
  TOGGLE_LEGEND = 'TOGGLE_LEGEND',
  TOGGLE_GRAPH_NODE_LABEL = 'TOGGLE_GRAPH_NODE_LABEL',
  TOGGLE_GRAPH_CIRCUIT_BREAKERS = 'TOGGLE_GRAPH_CIRCUIT_BREAKERS',
  TOGGLE_GRAPH_VIRTUAL_SERVICES = 'TOGGLE_GRAPH_VIRTUAL_SERVICES',
  TOGGLE_GRAPH_MISSING_SIDECARS = 'TOGGLE_GRAPH_MISSING_SIDECARS',
  TOGGLE_GRAPH_SECURITY = 'TOGGLE_GRAPH_SECURITY',
  TOGGLE_SERVICE_NODES = 'TOGGLE_SERVICE_NODES',
  TOGGLE_TRAFFIC_ANIMATION = 'TOGGLE_TRAFFIC_ANIMATION',
  TOGGLE_UNUSED_NODES = 'TOGGLE_UNUSED_NODES',
  SET_GRAPH_EDGE_LABEL_MODE = 'SET_GRAPH_EDGE_LABEL_MODE',
  // Disable Actions
  ENABLE_GRAPH_FILTERS = 'ENABLE_GRAPH_FILTERS'
}

export const GraphFilterActions = {
  // Toggle actions
  toggleGraphNodeLabel: createAction(GraphFilterActionKeys.TOGGLE_GRAPH_NODE_LABEL),
  toggleLegend: createAction(GraphFilterActionKeys.TOGGLE_LEGEND),
  setGraphEdgeLabelMode: createAction(
    GraphFilterActionKeys.SET_GRAPH_EDGE_LABEL_MODE,
    (edgeLabelMode: EdgeLabelMode) => ({
      type: GraphFilterActionKeys.SET_GRAPH_EDGE_LABEL_MODE,
      payload: edgeLabelMode
    })
  ),
  toggleGraphVirtualServices: createAction(GraphFilterActionKeys.TOGGLE_GRAPH_VIRTUAL_SERVICES),
  toggleGraphCircuitBreakers: createAction(GraphFilterActionKeys.TOGGLE_GRAPH_CIRCUIT_BREAKERS),
  toggleGraphMissingSidecars: createAction(GraphFilterActionKeys.TOGGLE_GRAPH_MISSING_SIDECARS),
  toggleGraphSecurity: createAction(GraphFilterActionKeys.TOGGLE_GRAPH_SECURITY),
  toggleServiceNodes: createAction(GraphFilterActionKeys.TOGGLE_SERVICE_NODES),
  toggleTrafficAnimation: createAction(GraphFilterActionKeys.TOGGLE_TRAFFIC_ANIMATION),
  toggleUnusedNodes: createAction(GraphFilterActionKeys.TOGGLE_UNUSED_NODES),
  showGraphFilters: createAction(GraphFilterActionKeys.ENABLE_GRAPH_FILTERS, (value: boolean) => ({
    type: GraphFilterActionKeys.ENABLE_GRAPH_FILTERS,
    payload: value
  }))
};
