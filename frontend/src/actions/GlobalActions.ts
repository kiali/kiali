// Action Creators allow us to create typesafe utilities for dispatching actions
import { ActionType, createAction, createStandardAction } from 'typesafe-actions';
import { ActionKeys } from './ActionKeys';
import { TimeInMilliseconds } from '../types/Common';

export const GlobalActions = {
  unknown: createAction('KIALI_UNKNOWN'), // helper for testing
  incrementLoadingCounter: createAction(ActionKeys.INCREMENT_LOADING_COUNTER),
  decrementLoadingCounter: createAction(ActionKeys.DECREMENT_LOADING_COUNTER),
  setPageVisibilityHidden: createAction(ActionKeys.SET_PAGE_VISIBILITY_HIDDEN),
  setPageVisibilityVisible: createAction(ActionKeys.SET_PAGE_VISIBILITY_VISIBLE),
  setLastRefreshAt: createStandardAction(ActionKeys.SET_LAST_REFRESH)<TimeInMilliseconds>()
};

export type GlobalAction = ActionType<typeof GlobalActions>;
