import { ServiceGraphState } from '../store/Store';
import { ServiceGraphDataActionKeys } from '../actions/ServiceGraphDataActions';
import { ServiceGraphActionKeys } from '../actions/ServiceGraphActions';
import FilterStateReducer from './ServiceGraphFilterState';

const INITIAL_STATE: any = {
  isLoading: false,
  graphDataTimestamp: 0,
  graphData: {},
  sidePanelInfo: null,
  hideLegend: true
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
      console.log('ServiceGraphDataState reducer: graph data is loading...');
      newState.isLoading = true;
      newState.sidePanelInfo = null;
      break;
    case ServiceGraphDataActionKeys.HANDLE_LEGEND:
      console.log('ServiceGraphDataState reducer: ' + (state.hideLegend ? 'hide' : 'show') + 'legend...');
      return {
        ...state,
        hideLegend: !state.hideLegend
      };
    case ServiceGraphDataActionKeys.GET_GRAPH_DATA_SUCCESS:
      console.log('ServiceGraphDataState reducer: graph data successfully received');
      newState.isLoading = false;
      newState.graphDataTimestamp = action.timestamp;
      newState.graphData = action.graphData;
      break;
    case ServiceGraphDataActionKeys.GET_GRAPH_DATA_FAILURE:
      console.warn('ServiceGraphDataState reducer: failed to get graph data');
      newState.isLoading = false;
      // newState.error = action.error; // Already handled in the action.
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
