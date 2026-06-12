import { getType } from 'typesafe-actions';
import { updateState } from '../utils/Reducer';
import { ServicesListState } from '../store/Store';
import { KialiAppAction } from '../actions/KialiAppAction';
import { ServicesListActions } from '../actions/ServicesListActions';

export const INITIAL_SERVICES_LIST_STATE: ServicesListState = {
  hiddenColumnIds: [],
  columnOrder: []
};

export const ServicesListStateReducer = (
  state: ServicesListState = INITIAL_SERVICES_LIST_STATE,
  action: KialiAppAction
): ServicesListState => {
  switch (action.type) {
    case getType(ServicesListActions.setHiddenColumns):
      return updateState(state, { hiddenColumnIds: action.payload });
    case getType(ServicesListActions.setColumnOrder):
      return updateState(state, { columnOrder: action.payload });
    default:
      return state;
  }
};
