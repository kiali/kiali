// Action Creators allow us to create typesafe utilities for dispatching actions
import { createAction } from 'typesafe-actions';
import { EdgeLabelMode, PollIntervalInMs } from '../types/GraphFilter';

export enum ServiceGraphFilterActionKeys {
  // Toggle Actions
  TOGGLE_LEGEND = 'TOGGLE_LEGEND',
  TOGGLE_GRAPH_NODE_LABEL = 'TOGGLE_GRAPH_NODE_LABEL',
  TOGGLE_GRAPH_CIRCUIT_BREAKERS = 'TOGGLE_GRAPH_CIRCUIT_BREAKERS',
  TOGGLE_GRAPH_VIRTUAL_SERVICES = 'TOGGLE_GRAPH_VIRTUAL_SERVICES',
  TOGGLE_GRAPH_MISSING_SIDECARS = 'TOGGLE_GRAPH_MISSING_SIDECARS',
  TOGGLE_TRAFFIC_ANIMATION = 'TOGGLE_TRAFFIC_ANIMATION',
  SET_GRAPH_EDGE_LABEL_MODE = 'SET_GRAPH_EDGE_LABEL_MODE',
  // Disable Actions
  ENABLE_GRAPH_FILTERS = 'ENABLE_GRAPH_FILTERS',
  // Refresh Rate
  SET_GRAPH_REFRESH_RATE = 'SET_GRAPH_REFRESH_RATE'
}

export const serviceGraphFilterActions = {
  // Toggle actions
  toggleGraphNodeLabel: createAction(ServiceGraphFilterActionKeys.TOGGLE_GRAPH_NODE_LABEL),
  toggleLegend: createAction(ServiceGraphFilterActionKeys.TOGGLE_LEGEND),
  setGraphEdgeLabelMode: createAction(
    ServiceGraphFilterActionKeys.SET_GRAPH_EDGE_LABEL_MODE,
    (edgeLabelMode: EdgeLabelMode) => ({
      type: ServiceGraphFilterActionKeys.SET_GRAPH_EDGE_LABEL_MODE,
      payload: edgeLabelMode
    })
  ),
  toggleGraphVirtualServices: createAction(ServiceGraphFilterActionKeys.TOGGLE_GRAPH_VIRTUAL_SERVICES),
  toggleGraphCircuitBreakers: createAction(ServiceGraphFilterActionKeys.TOGGLE_GRAPH_CIRCUIT_BREAKERS),
  toggleGraphMissingSidecars: createAction(ServiceGraphFilterActionKeys.TOGGLE_GRAPH_MISSING_SIDECARS),
  toggleTrafficAnimation: createAction(ServiceGraphFilterActionKeys.TOGGLE_TRAFFIC_ANIMATION),
  showGraphFilters: createAction(ServiceGraphFilterActionKeys.ENABLE_GRAPH_FILTERS, (value: boolean) => ({
    type: ServiceGraphFilterActionKeys.ENABLE_GRAPH_FILTERS,
    payload: value
  })),
  setRefreshRate: createAction(ServiceGraphFilterActionKeys.SET_GRAPH_REFRESH_RATE, (value: PollIntervalInMs) => ({
    type: ServiceGraphFilterActionKeys.SET_GRAPH_REFRESH_RATE,
    payload: value
  }))
};
