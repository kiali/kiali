import { createAction } from 'typesafe-actions';
import { DurationIntervalInSeconds, PollIntervalInMs } from '../types/Common';

export enum UserSettingsActionKeys {
  NAV_COLLAPSE = 'NAV_COLLAPSE',
  SET_DURATION_INTERVAL = 'SET_DURATION_INTERVAL',
  SET_REFRESH_INTERVAL = 'SET_REFRESH_INTERVAL'
}

export const UserSettingsActions = {
  navCollapse: createAction(UserSettingsActionKeys.NAV_COLLAPSE, (collapsed: boolean) => ({
    type: UserSettingsActionKeys.NAV_COLLAPSE,
    collapse: collapsed
  })),
  setDurationInterval: createAction(
    UserSettingsActionKeys.SET_DURATION_INTERVAL,
    (duration: DurationIntervalInSeconds) => ({
      type: UserSettingsActionKeys.SET_DURATION_INTERVAL,
      payload: duration
    })
  ),
  setRefreshInterval: createAction(
    UserSettingsActionKeys.SET_REFRESH_INTERVAL,
    (refreshInterval: PollIntervalInMs) => ({
      type: UserSettingsActionKeys.SET_REFRESH_INTERVAL,
      payload: refreshInterval
    })
  ),
  setNavCollapsed: (collapsed: boolean) => {
    return dispatch => {
      dispatch(UserSettingsActions.navCollapse(collapsed));
    };
  }
};
