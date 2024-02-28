// Action Creators allow us to create typesafe utilities for dispatching actions
import { ActionType, createAction, createStandardAction } from 'typesafe-actions';
import { ActionKeys } from './ActionKeys';
import { KioskMode } from '../types/Common';

export const GlobalActions = {
  unknown: createAction('KIALI_UNKNOWN'), // helper for testing
  incrementLoadingCounter: createAction(ActionKeys.INCREMENT_LOADING_COUNTER),
  decrementLoadingCounter: createAction(ActionKeys.DECREMENT_LOADING_COUNTER),
  setPageVisibilityHidden: createAction(ActionKeys.SET_PAGE_VISIBILITY_HIDDEN),
  setPageVisibilityVisible: createAction(ActionKeys.SET_PAGE_VISIBILITY_VISIBLE),
  setKiosk: createStandardAction(ActionKeys.SET_KIOSK)<KioskMode>(),
  setLocale: createStandardAction(ActionKeys.SET_LOCALE)<string>(),
  setTheme: createStandardAction(ActionKeys.SET_THEME)<string>()
};

export type GlobalAction = ActionType<typeof GlobalActions>;
