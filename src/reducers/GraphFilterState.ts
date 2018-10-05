import { GraphFilterState } from '../store/Store';
import { GraphFilterActionKeys } from '../actions/GraphFilterActions';
import { updateState } from '../utils/Reducer';
import { config } from '../config';

const INITIAL_STATE: GraphFilterState = {
  showLegend: false,
  showNodeLabels: true,
  showCircuitBreakers: true,
  showVirtualServices: true,
  showMissingSidecars: true,
  showSecurity: false,
  showServiceNodes: false,
  showTrafficAnimation: false,
  showUnusedNodes: false,
  // @ todo: add disableLayers back in later
  // disableLayers: false
  // edgeLabelMode: EdgeLabelMode.HIDE,
  refreshRate: config().toolbar.defaultPollInterval
};

// This Reducer allows changes to the 'graphFilterState' portion of Redux Store
const graphFilterState = (state: GraphFilterState = INITIAL_STATE, action) => {
  switch (action.type) {
    case GraphFilterActionKeys.TOGGLE_LEGEND:
      return updateState(state, { showLegend: !state.showLegend });
    case GraphFilterActionKeys.TOGGLE_GRAPH_NODE_LABEL:
      return updateState(state, { showNodeLabels: !state.showNodeLabels });
    case GraphFilterActionKeys.SET_GRAPH_EDGE_LABEL_MODE:
      return updateState(state, { edgeLabelMode: action.payload });
    case GraphFilterActionKeys.TOGGLE_GRAPH_CIRCUIT_BREAKERS:
      return updateState(state, { showCircuitBreakers: !state.showCircuitBreakers });
    case GraphFilterActionKeys.TOGGLE_GRAPH_VIRTUAL_SERVICES:
      return updateState(state, { showVirtualServices: !state.showVirtualServices });
    case GraphFilterActionKeys.TOGGLE_GRAPH_MISSING_SIDECARS:
      return updateState(state, { showMissingSidecars: !state.showMissingSidecars });
    case GraphFilterActionKeys.TOGGLE_GRAPH_SECURITY:
      return updateState(state, { showSecurity: !state.showSecurity });
    case GraphFilterActionKeys.TOGGLE_SERVICE_NODES:
      return updateState(state, { showServiceNodes: !state.showServiceNodes });
    case GraphFilterActionKeys.TOGGLE_TRAFFIC_ANIMATION:
      return updateState(state, { showTrafficAnimation: !state.showTrafficAnimation });
    case GraphFilterActionKeys.TOGGLE_UNUSED_NODES:
      return updateState(state, { showUnusedNodes: !state.showUnusedNodes });
    case GraphFilterActionKeys.ENABLE_GRAPH_FILTERS:
      return updateState(state, { disableLayers: action.payload });
    case GraphFilterActionKeys.SET_GRAPH_REFRESH_RATE:
      return updateState(state, { refreshRate: action.payload });
    default:
      return state;
  }
};

export default graphFilterState;
