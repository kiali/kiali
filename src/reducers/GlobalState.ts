import { GlobalState } from '../store/Store';
import { updateState } from '../utils/Reducer';
import { GlobalActionKeys } from '../actions/GlobalActions';

const INITIAL_GLOBAL_STATE: GlobalState = {
  isLoading: false
};

// This Reducer allows changes to the 'globalState' portion of Redux Store
const globalState = (state: GlobalState = INITIAL_GLOBAL_STATE, action) => {
  switch (action.type) {
    case GlobalActionKeys.TOGGLE_LOADING_SPINNER:
      return updateState(state, { isLoading: !state.isLoading });
    case GlobalActionKeys.LOADING_SPINNER_ON:
      return updateState(state, { isLoading: true });
    case GlobalActionKeys.LOADING_SPINNER_OFF:
      return updateState(state, { isLoading: false });
    case GlobalActionKeys.SET_LOADING_SPINNER:
      return updateState(state, { isLoading: action.payload });
    default:
      return state;
  }
};

export default globalState;
