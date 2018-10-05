import { GraphState } from '../store/Store';
import { GraphDataActionKeys } from '../actions/GraphDataActionKeys';
import { GraphActionKeys } from '../actions/GraphActions';
import FilterStateReducer from './GraphFilterState';
import { MILLISECONDS } from '../types/Common';

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
    showTrafficAnimation: false,
    showServiceNodes: false,
    refreshRate: 15 * MILLISECONDS
  }
};

// This Reducer allows changes to the 'graphDataState' portion of Redux Store
const graphDataState = (state: GraphState = INITIAL_GRAPH_STATE, action) => {
  const filterState = FilterStateReducer(state.filterState, action);
  let newState: GraphState = {
    ...state,
    filterState
  };

  switch (action.type) {
    case GraphDataActionKeys.GET_GRAPH_DATA_START:
      newState.isLoading = true;
      newState.isError = false;
      break;
    case GraphDataActionKeys.GET_GRAPH_DATA_SUCCESS:
      newState.isLoading = false;
      newState.isError = false;
      newState.graphDataTimestamp = action.timestamp;
      newState.graphData = action.graphData;
      break;
    case GraphDataActionKeys.GET_GRAPH_DATA_FAILURE:
      newState.isLoading = false;
      newState.isError = true;
      newState.error = action.error;
      break;
    case GraphActionKeys.GRAPH_SIDE_PANEL_SHOW_INFO:
      newState.sidePanelInfo = {
        kind: action.summaryType,
        graphReference: action.summaryTarget
      };
      break;
    case GraphActionKeys.GRAPH_CHANGED:
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
