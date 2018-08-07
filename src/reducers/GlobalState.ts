import { GlobalState } from '../store/Store';
import { updateState } from '../utils/Reducer';
import { GlobalActionKeys } from '../actions/GlobalActions';

const INITIAL_GLOBAL_STATE: GlobalState = {
  loadingCounter: 0,
  isPageVisible: true
};

// This Reducer allows changes to the 'globalState' portion of Redux Store
const globalState = (state: GlobalState = INITIAL_GLOBAL_STATE, action) => {
  switch (action.type) {
    case GlobalActionKeys.INCREMENT_LOADING_COUNTER:
      return updateState(state, { loadingCounter: state.loadingCounter + 1 });
    case GlobalActionKeys.DECREMENT_LOADING_COUNTER:
      return updateState(state, { loadingCounter: Math.max(0, state.loadingCounter - 1) });
    case GlobalActionKeys.SET_PAGE_VISIBILITY_HIDDEN:
      return updateState(state, { isPageVisible: false });
    case GlobalActionKeys.SET_PAGE_VISIBILITY_VISIBLE:
      return updateState(state, { isPageVisible: true });
    default:
      return state;
  }
};

export default globalState;
