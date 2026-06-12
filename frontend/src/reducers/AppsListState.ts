import { getType } from 'typesafe-actions';
import { updateState } from '../utils/Reducer';
import { AppsListState } from '../store/Store';
import { KialiAppAction } from '../actions/KialiAppAction';
import { AppsListActions } from '../actions/AppsListActions';

export const INITIAL_APPS_LIST_STATE: AppsListState = {
  hiddenColumnIds: [],
  columnOrder: []
};

export const AppsListStateReducer = (
  state: AppsListState = INITIAL_APPS_LIST_STATE,
  action: KialiAppAction
): AppsListState => {
  switch (action.type) {
    case getType(AppsListActions.setHiddenColumns):
      return updateState(state, { hiddenColumnIds: action.payload });
    case getType(AppsListActions.setColumnOrder):
      return updateState(state, { columnOrder: action.payload });
    default:
      return state;
  }
};
