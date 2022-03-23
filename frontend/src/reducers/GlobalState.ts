import { GlobalState } from '../store/Store';
import { updateState } from '../utils/Reducer';
import { GlobalActions } from '../actions/GlobalActions';
import { KialiAppAction } from '../actions/KialiAppAction';
import { getType } from 'typesafe-actions';

export const INITIAL_GLOBAL_STATE: GlobalState = {
  loadingCounter: 0,
  isPageVisible: true,
  lastRefreshAt: 0
};

// This Reducer allows changes to the 'globalState' portion of Redux Store
const globalState = (state: GlobalState = INITIAL_GLOBAL_STATE, action: KialiAppAction): GlobalState => {
  switch (action.type) {
    case getType(GlobalActions.incrementLoadingCounter):
      return updateState(state, { loadingCounter: state.loadingCounter + 1 });
    case getType(GlobalActions.decrementLoadingCounter):
      return updateState(state, { loadingCounter: Math.max(0, state.loadingCounter - 1) });
    case getType(GlobalActions.setPageVisibilityHidden):
      return updateState(state, { isPageVisible: false });
    case getType(GlobalActions.setPageVisibilityVisible):
      return updateState(state, { isPageVisible: true });
    case getType(GlobalActions.setLastRefreshAt):
      return updateState(state, { lastRefreshAt: action.payload });
    default:
      return state;
  }
};

export default globalState;
