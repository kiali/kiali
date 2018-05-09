// Action Creators allow us to create typesafe utilities for dispatching actions
import { createAction } from 'typesafe-actions';

export enum ServiceGraphFilterActionKeys {
  // Toggle Actions
  TOGGLE_GRAPH_NODE_LABEL = 'TOGGLE_GRAPH_NODE_LABEL',
  TOGGLE_GRAPH_EDGE_LABEL = 'TOGGLE_GRAPH_EDGE_LABEL',
  TOGGLE_GRAPH_CIRCUIT_BREAKERS = 'TOGGLE_GRAPH_CIRCUIT_BREAKERS',
  TOGGLE_GRAPH_ROUTE_RULES = 'TOGGLE_GRAPH_ROUTE_RULES',
  // Disable Actions
  DISABLE_GRAPH_LAYERS = 'DISABLE_GRAPH_LAYERS'
}

export const serviceGraphFilterActions = {
  // Toggle actions
  toggleGraphNodeLabel: createAction(ServiceGraphFilterActionKeys.TOGGLE_GRAPH_NODE_LABEL),
  toggleGraphEdgeLabel: createAction(ServiceGraphFilterActionKeys.TOGGLE_GRAPH_EDGE_LABEL),
  toggleGraphRouteRules: createAction(ServiceGraphFilterActionKeys.TOGGLE_GRAPH_ROUTE_RULES),
  toggleGraphCircuitBreakers: createAction(ServiceGraphFilterActionKeys.TOGGLE_GRAPH_CIRCUIT_BREAKERS),
  disableGraphLayers: createAction(ServiceGraphFilterActionKeys.DISABLE_GRAPH_LAYERS, (value: boolean) => ({
    type: ServiceGraphFilterActionKeys.DISABLE_GRAPH_LAYERS,
    payload: value
  }))
};
