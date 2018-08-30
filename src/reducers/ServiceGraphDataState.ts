import { ServiceGraphState } from '../store/Store';
import { ServiceGraphDataActionKeys } from '../actions/ServiceGraphDataActionKeys';
import { ServiceGraphActionKeys } from '../actions/ServiceGraphActions';
import FilterStateReducer from './ServiceGraphFilterState';
import { MILLISECONDS } from '../types/Common';

const INITIAL_STATE: ServiceGraphState = {
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
    showTrafficAnimation: false,
    refreshRate: 15 * MILLISECONDS
  }
};

// This Reducer allows changes to the 'serviceGraphDataState' portion of Redux Store
const serviceGraphDataState = (state: ServiceGraphState = INITIAL_STATE, action) => {
  const filterState = FilterStateReducer(state.filterState, action);
  let newState: ServiceGraphState = {
    ...state,
    filterState
  };

  switch (action.type) {
    case ServiceGraphDataActionKeys.GET_GRAPH_DATA_START:
      newState.isLoading = true;
      newState.isError = false;
      break;
    case ServiceGraphDataActionKeys.GET_GRAPH_DATA_SUCCESS:
      newState.isLoading = false;
      newState.isError = false;
      newState.graphDataTimestamp = action.timestamp;
      newState.graphData = action.graphData;
      break;
    case ServiceGraphDataActionKeys.GET_GRAPH_DATA_FAILURE:
      newState.isLoading = false;
      newState.isError = true;
      newState.error = action.error;
      break;
    case ServiceGraphActionKeys.SERVICE_GRAPH_SIDE_PANEL_SHOW_INFO:
      newState.sidePanelInfo = {
        kind: action.summaryType,
        graphReference: action.summaryTarget
      };
      break;
    default:
      break;
  }

  return newState;
};

export default serviceGraphDataState;
