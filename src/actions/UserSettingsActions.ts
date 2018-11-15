import { ActionType, createAction, createStandardAction } from 'typesafe-actions';
import { DurationInSeconds, PollIntervalInMs } from '../types/Common';

enum UserSettingsActionKeys {
  NAV_COLLAPSE = 'NAV_COLLAPSE',
  SET_DURATION = 'SET_DURATION',
  SET_REFRESH_INTERVAL = 'SET_REFRESH_INTERVAL'
}

export const UserSettingsActions = {
  navCollapse: createAction(UserSettingsActionKeys.NAV_COLLAPSE, resolve => (collapsed: boolean) =>
    resolve({ collapse: collapsed })
  ),
  setDuration: createStandardAction(UserSettingsActionKeys.SET_DURATION)<DurationInSeconds>(),
  setRefreshInterval: createStandardAction(UserSettingsActionKeys.SET_REFRESH_INTERVAL)<PollIntervalInMs>()
};

export const UserSettingsThunkActions = {
  setNavCollapsed: (collapsed: boolean) => dispatch => dispatch(UserSettingsActions.navCollapse(collapsed))
};

export type UserSettingsAction = ActionType<typeof UserSettingsActions>;
