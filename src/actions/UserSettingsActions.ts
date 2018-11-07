import { createAction } from 'typesafe-actions';
import { DurationInSeconds, PollIntervalInMs } from '../types/Common';

export enum UserSettingsActionKeys {
  NAV_COLLAPSE = 'NAV_COLLAPSE',
  SET_DURATION = 'SET_DURATION',
  SET_REFRESH_INTERVAL = 'SET_REFRESH_INTERVAL'
}

export const UserSettingsActions = {
  navCollapse: createAction(UserSettingsActionKeys.NAV_COLLAPSE, (collapsed: boolean) => ({
    type: UserSettingsActionKeys.NAV_COLLAPSE,
    collapse: collapsed
  })),
  setDuration: createAction(UserSettingsActionKeys.SET_DURATION, (duration: DurationInSeconds) => ({
    type: UserSettingsActionKeys.SET_DURATION,
    payload: duration
  })),
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
