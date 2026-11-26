import { getType } from 'types/typesafeActionsLegacy';
import { updateState } from '../utils/Reducer';
import type { WorkloadsListState } from '../store/Store';
import type { KialiAppAction } from '../actions/KialiAppAction';
import { WorkloadsListActions } from '../actions/WorkloadsListActions';

export const INITIAL_WORKLOADS_LIST_STATE: WorkloadsListState = {
  hiddenColumnIds: [],
  columnOrder: []
};

export const WorkloadsListStateReducer = (
  state: WorkloadsListState = INITIAL_WORKLOADS_LIST_STATE,
  action: KialiAppAction
): WorkloadsListState => {
  switch (action.type) {
    case getType(WorkloadsListActions.setHiddenColumns):
      return updateState(state, { hiddenColumnIds: action.payload });
    case getType(WorkloadsListActions.setColumnOrder):
      return updateState(state, { columnOrder: action.payload });
    default:
      return state;
  }
};
