import { getType } from 'typesafe-actions';
import { updateState } from '../utils/Reducer';
import { NamespacesListState } from '../store/Store';
import { KialiAppAction } from '../actions/KialiAppAction';
import { NamespacesListActions } from '../actions/NamespacesListActions';

export const INITIAL_NAMESPACES_LIST_STATE: NamespacesListState = {
  hiddenColumnIds: [],
  columnOrder: []
};

export const NamespacesListStateReducer = (
  state: NamespacesListState = INITIAL_NAMESPACES_LIST_STATE,
  action: KialiAppAction
): NamespacesListState => {
  switch (action.type) {
    case getType(NamespacesListActions.setHiddenColumns):
      return updateState(state, { hiddenColumnIds: action.payload });
    case getType(NamespacesListActions.setColumnOrder):
      return updateState(state, { columnOrder: action.payload });
    default:
      return state;
  }
};
