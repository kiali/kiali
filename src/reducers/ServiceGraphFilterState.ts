import { ServiceGraphFilterState } from '../store/Store';
import { ServiceGraphFilterActionKeys } from '../actions/ServiceGraphFilterActions';
import { updateState } from '../utils/Reducer';

const INITIAL_STATE: ServiceGraphFilterState = {
  showNodeLabels: true,
  showEdgeLabels: false,
  showCircuitBreakers: false,
  showRouteRules: true
  // @ todo: add disableLayers back in later
  // disableLayers: false
};

// This Reducer allows changes to the 'serviceGraphFilterState' portion of Redux Store
const serviceGraphFilterState = (state: ServiceGraphFilterState = INITIAL_STATE, action) => {
  switch (action.type) {
    case ServiceGraphFilterActionKeys.TOGGLE_GRAPH_NODE_LABEL:
      return updateState(state, { showNodeLabels: !state.showNodeLabels });
    case ServiceGraphFilterActionKeys.TOGGLE_GRAPH_EDGE_LABEL:
      return updateState(state, { showEdgeLabels: !state.showEdgeLabels });
    case ServiceGraphFilterActionKeys.TOGGLE_GRAPH_CIRCUIT_BREAKERS:
      return updateState(state, { showCircuitBreakers: !state.showCircuitBreakers });
    case ServiceGraphFilterActionKeys.TOGGLE_GRAPH_ROUTE_RULES:
      return updateState(state, { showRouteRules: !state.showRouteRules });
    case ServiceGraphFilterActionKeys.ENABLE_GRAPH_FILTERS:
      return updateState(state, { disableLayers: action.payload });
    default:
      return state;
  }
};

export default serviceGraphFilterState;
