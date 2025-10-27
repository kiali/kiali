// Action Creators allow us to create typesafe utilities for dispatching actions
import { ActionType, createAction, createStandardAction } from 'typesafe-actions';
import { ActionKeys } from './ActionKeys';
import { KioskData, KioskMode } from '../types/Common';

export const GlobalActions = {
  incrementLoadingCounter: createAction(ActionKeys.INCREMENT_LOADING_COUNTER),
  decrementLoadingCounter: createAction(ActionKeys.DECREMENT_LOADING_COUNTER),
  setKiosk: createStandardAction(ActionKeys.SET_KIOSK)<KioskMode>(),
  setKioskData: createStandardAction(ActionKeys.SET_KIOSK_DATA)<KioskData>(),
  setLanguage: createStandardAction(ActionKeys.SET_LANGUAGE)<string>(),
  setPageVisibilityHidden: createAction(ActionKeys.SET_PAGE_VISIBILITY_HIDDEN),
  setPageVisibilityVisible: createAction(ActionKeys.SET_PAGE_VISIBILITY_VISIBLE),
  setTheme: createStandardAction(ActionKeys.SET_THEME)<string>(),
  unknown: createAction('KIALI_UNKNOWN') // helper for testing
};

export type GlobalAction = ActionType<typeof GlobalActions>;
