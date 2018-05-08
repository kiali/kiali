import { ServiceGraphDataState } from '../store/Store';
import { ServiceGraphDataActionsType } from '../actions/ServiceGraphDataActions';

const INITIAL_STATE: ServiceGraphDataState = {
  isLoading: false,
  timestamp: 0,
  graphData: {}
};

// This Reducer allows changes to the 'serviceGraphDataState' portion of Redux Store
const serviceGraphDataState = (state: ServiceGraphDataState = INITIAL_STATE, action) => {
  switch (action.type) {
    case ServiceGraphDataActionsType.GET_GRAPH_DATA_START:
      console.log('ServiceGraphDataState reducer: graph data is loading...');
      return {
        ...state,
        isLoading: true
      };
    case ServiceGraphDataActionsType.GET_GRAPH_DATA_SUCCESS:
      console.log('ServiceGraphDataState reducer: graph data successfully received');
      return {
        ...state,
        isLoading: false,
        timestamp: action.timestamp,
        graphData: action.graphData
      };
    case ServiceGraphDataActionsType.GET_GRAPH_DATA_FAILURE:
      console.warn('ServiceGraphDataState reducer: failed to get graph data');
      return {
        ...state,
        isLoading: false,
        error: action.error
      };
    default:
      return state;
  }
};

export default serviceGraphDataState;
