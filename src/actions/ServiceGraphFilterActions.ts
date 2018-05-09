// Action Creators allow us to create typesafe utilities for dispatching actions
import { createAction } from 'typesafe-actions';

export enum ServiceGraphFilterActionKeys {
  // Toggle Actions
  TOGGLE_GRAPH_NODE_LABEL = 'TOGGLE_GRAPH_NODE_LABEL',
  TOGGLE_GRAPH_EDGE_LABEL = 'TOGGLE_GRAPH_EDGE_LABEL',
  TOGGLE_GRAPH_CIRCUIT_BREAKERS = 'TOGGLE_GRAPH_CIRCUIT_BREAKERS',
  TOGGLE_GRAPH_ROUTE_RULES = 'TOGGLE_GRAPH_ROUTE_RULES',
  // Disable Actions
  ENABLE_GRAPH_FILTERS = 'ENABLE_GRAPH_FILTERS'
}

export const serviceGraphFilterActions = {
  // Toggle actions
  toggleGraphNodeLabel: createAction(ServiceGraphFilterActionKeys.TOGGLE_GRAPH_NODE_LABEL),
  toggleGraphEdgeLabel: createAction(ServiceGraphFilterActionKeys.TOGGLE_GRAPH_EDGE_LABEL),
  toggleGraphRouteRules: createAction(ServiceGraphFilterActionKeys.TOGGLE_GRAPH_ROUTE_RULES),
  toggleGraphCircuitBreakers: createAction(ServiceGraphFilterActionKeys.TOGGLE_GRAPH_CIRCUIT_BREAKERS),
  showGraphFilters: createAction(ServiceGraphFilterActionKeys.ENABLE_GRAPH_FILTERS, (value: boolean) => ({
    type: ServiceGraphFilterActionKeys.ENABLE_GRAPH_FILTERS,
    payload: value
  }))
};
