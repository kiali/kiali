// Action Creators allow us to create typesafe utilities for dispatching actions
import { ActionType, createAction } from 'typesafe-actions';

enum GlobalActionKeys {
  INCREMENT_LOADING_COUNTER = 'INCREMENT_LOADING_COUNTER',
  DECREMENT_LOADING_COUNTER = 'DECREMENT_LOADING_COUNTER',
  SET_PAGE_VISIBILITY_HIDDEN = 'SET_PAGE_VISIBILITY_HIDDEN',
  SET_PAGE_VISIBILITY_VISIBLE = 'SET_PAGE_VISIBILITY_VISIBLE'
}

export const GlobalActions = {
  nil: createAction('KIALI_NIL'), // helper for testing
  incrementLoadingCounter: createAction(GlobalActionKeys.INCREMENT_LOADING_COUNTER),
  decrementLoadingCounter: createAction(GlobalActionKeys.DECREMENT_LOADING_COUNTER),
  setPageVisibilityHidden: createAction(GlobalActionKeys.SET_PAGE_VISIBILITY_HIDDEN),
  setPageVisibilityVisible: createAction(GlobalActionKeys.SET_PAGE_VISIBILITY_VISIBLE)
};

export type GlobalAction = ActionType<typeof GlobalActions>;
