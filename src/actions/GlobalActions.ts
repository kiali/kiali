// Action Creators allow us to create typesafe utilities for dispatching actions
import { createAction } from 'typesafe-actions';

export enum GlobalActionKeys {
  // Toggle Actions
  TOGGLE_LOADING_SPINNER = 'TOGGLE_LOADING_SPINNER',
  SET_LOADING_SPINNER = 'SET_LOADING_SPINNER',
  LOADING_SPINNER_OFF = 'LOADING_SPINNER_OFF',
  LOADING_SPINNER_ON = 'LOADING_SPINNER_ON'
}

export const globalActions = {
  // Toggle actions
  toggleLoadingSpinner: createAction(GlobalActionKeys.TOGGLE_LOADING_SPINNER),
  setLoadingSpinner: createAction(GlobalActionKeys.SET_LOADING_SPINNER, (isLoading: boolean) => ({
    type: GlobalActionKeys.SET_LOADING_SPINNER,
    payload: isLoading
  })),
  loadingSpinnerOn: createAction(GlobalActionKeys.LOADING_SPINNER_ON),
  loadingSpinnerOff: createAction(GlobalActionKeys.LOADING_SPINNER_OFF)
};
