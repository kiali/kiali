import { getType } from 'typesafe-actions';
import { GraphFilterState } from '../store/Store';
import { updateState } from '../utils/Reducer';
import { KialiAppAction } from '../actions/KialiAppAction';
import { GraphFilterActions } from '../actions/GraphFilterActions';

const INITIAL_STATE: GraphFilterState = {
  showLegend: false,
  showNodeLabels: true,
  showCircuitBreakers: true,
  showVirtualServices: true,
  showMissingSidecars: true,
  showSecurity: false,
  showServiceNodes: false,
  showTrafficAnimation: false,
  showUnusedNodes: false
  // @ todo: add disableLayers back in later
  // disableLayers: false
  // edgeLabelMode: EdgeLabelMode.HIDE,
};

// This Reducer allows changes to the 'graphFilterState' portion of Redux Store
const graphFilterState = (state: GraphFilterState = INITIAL_STATE, action: KialiAppAction): GraphFilterState => {
  switch (action.type) {
    case getType(GraphFilterActions.toggleLegend):
      return updateState(state, { showLegend: !state.showLegend });
    case getType(GraphFilterActions.toggleGraphNodeLabel):
      return updateState(state, { showNodeLabels: !state.showNodeLabels });
    // case getType(GraphFilterActions.setGraphEdgeLabelMode):
    //   return updateState(state, { edgeLabelMode: action.payload });
    case getType(GraphFilterActions.toggleGraphCircuitBreakers):
      return updateState(state, { showCircuitBreakers: !state.showCircuitBreakers });
    case getType(GraphFilterActions.toggleGraphVirtualServices):
      return updateState(state, { showVirtualServices: !state.showVirtualServices });
    case getType(GraphFilterActions.toggleGraphMissingSidecars):
      return updateState(state, { showMissingSidecars: !state.showMissingSidecars });
    case getType(GraphFilterActions.toggleGraphSecurity):
      return updateState(state, { showSecurity: !state.showSecurity });
    case getType(GraphFilterActions.toggleServiceNodes):
      return updateState(state, { showServiceNodes: !state.showServiceNodes });
    case getType(GraphFilterActions.toggleTrafficAnimation):
      return updateState(state, { showTrafficAnimation: !state.showTrafficAnimation });
    case getType(GraphFilterActions.toggleUnusedNodes):
      return updateState(state, { showUnusedNodes: !state.showUnusedNodes });
    // case getType(GraphFilterActions.showGraphFilters):
    //   return updateState(state, { disableLayers: action.payload });
    default:
      return state;
  }
};

export default graphFilterState;
