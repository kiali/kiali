import { ServiceGraphState } from '../store/Store';
import { ServiceGraphActionsType } from '../actions/ServiceGraphActions';

const INITIAL_STATE: ServiceGraphState = {
  showNodeLabels: true,
  showEdgeLabels: false
};

// This Reducer allows changes to the 'serviceGraphState' portion of Redux Store
const serviceGraphState = (state: ServiceGraphState = INITIAL_STATE, action) => {
  switch (action.type) {
    case ServiceGraphActionsType.TOGGLE_GRAPH_NODE_LABEL:
      return {
        ...state,
        showNodeLabels: !state.showNodeLabels
      };
    case ServiceGraphActionsType.TOGGLE_GRAPH_EDGE_LABEL:
      return {
        ...state,
        showEdgeLabels: !state.showEdgeLabels
      };
    default:
      return state;
  }
};

export default serviceGraphState;
