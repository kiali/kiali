import { GlobalState } from '../store/Store';
import { updateState } from '../utils/Reducer';
import { GlobalActionKeys } from '../actions/GlobalActions';

const INITIAL_GLOBAL_STATE: GlobalState = {
  loadingCounter: 0
};

// This Reducer allows changes to the 'globalState' portion of Redux Store
const globalState = (state: GlobalState = INITIAL_GLOBAL_STATE, action) => {
  switch (action.type) {
    case GlobalActionKeys.INCREMENT_LOADING_COUNTER:
      return updateState(state, { loadingCounter: state.loadingCounter + 1 });
    case GlobalActionKeys.DECREMENT_LOADING_COUNTER:
      return updateState(state, { loadingCounter: Math.max(0, state.loadingCounter - 1) });
    default:
      return state;
  }
};

export default globalState;
