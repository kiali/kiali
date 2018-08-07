// Action Creators allow us to create typesafe utilities for dispatching actions
import { createAction } from 'typesafe-actions';

export enum GlobalActionKeys {
  INCREMENT_LOADING_COUNTER = 'INCREMENT_LOADING_COUNTER',
  DECREMENT_LOADING_COUNTER = 'DECREMENT_LOADING_COUNTER',
  SET_PAGE_VISIBILITY_HIDDEN = 'SET_PAGE_VISIBILITY_HIDDEN',
  SET_PAGE_VISIBILITY_VISIBLE = 'SET_PAGE_VISIBILITY_VISIBLE'
}

export const GlobalActions = {
  incrementLoadingCounter: createAction(GlobalActionKeys.INCREMENT_LOADING_COUNTER),
  decrementLoadingCounter: createAction(GlobalActionKeys.DECREMENT_LOADING_COUNTER),
  setPageVisibilityHidden: createAction(GlobalActionKeys.SET_PAGE_VISIBILITY_HIDDEN),
  setPageVisibilityVisible: createAction(GlobalActionKeys.SET_PAGE_VISIBILITY_VISIBLE)
};
