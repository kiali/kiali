import { getType } from 'typesafe-actions';
import { GraphActions } from '../actions/GraphActions';
import { GraphDataActions } from '../actions/GraphDataActions';
import { KialiAppAction } from '../actions/KialiAppAction';
import { GraphState } from '../store/Store';
import FilterStateReducer from './GraphFilterState';

export const INITIAL_GRAPH_STATE: GraphState = {
  isLoading: false,
  isError: false,
  error: undefined,
  graphDataTimestamp: 0,
  graphData: {},
  sidePanelInfo: null,
  filterState: {
    showLegend: false,
    showNodeLabels: true,
    showCircuitBreakers: true,
    showVirtualServices: true,
    showMissingSidecars: true,
    showSecurity: false,
    showServiceNodes: false,
    showTrafficAnimation: false,
    showUnusedNodes: false
  }
};

// This Reducer allows changes to the 'graphDataState' portion of Redux Store
const graphDataState = (state: GraphState = INITIAL_GRAPH_STATE, action: KialiAppAction): GraphState => {
  const filterState = FilterStateReducer(state.filterState, action);
  let newState: GraphState = {
    ...state,
    filterState
  };

  switch (action.type) {
    case getType(GraphDataActions.getGraphDataStart):
      newState.isLoading = true;
      newState.isError = false;
      break;
    case getType(GraphDataActions.getGraphDataSuccess):
      newState.isLoading = false;
      newState.isError = false;
      newState.graphDataTimestamp = action.payload.timestamp;
      newState.graphData = action.payload.graphData;
      break;
    case getType(GraphDataActions.getGraphDataFailure):
      newState.isLoading = false;
      newState.isError = true;
      newState.error = action.payload.error;
      break;
    case getType(GraphActions.showSidePanelInfo):
      newState.sidePanelInfo = {
        kind: action.payload.summaryType,
        graphReference: action.payload.summaryTarget
      };
      break;
    case getType(GraphActions.changed):
      newState.graphData = INITIAL_GRAPH_STATE.graphData;
      newState.graphDataTimestamp = INITIAL_GRAPH_STATE.graphDataTimestamp;
      newState.sidePanelInfo = INITIAL_GRAPH_STATE.sidePanelInfo;
      break;
    default:
      break;
  }

  return newState;
};

export default graphDataState;
