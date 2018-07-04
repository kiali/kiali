// Action Creators allow us to create typesafe utilities for dispatching actions
import { createAction } from 'typesafe-actions';

export enum GlobalActionKeys {
  INCREMENT_LOADING_COUNTER = 'INCREMENT_LOADING_COUNTER',
  DECREMENT_LOADING_COUNTER = 'DECREMENT_LOADING_COUNTER'
}

export const globalActions = {
  incrementLoadingCounter: createAction(GlobalActionKeys.INCREMENT_LOADING_COUNTER),
  decrementLoadingCounter: createAction(GlobalActionKeys.DECREMENT_LOADING_COUNTER)
};
