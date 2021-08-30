import { ActionType, createAction, createStandardAction } from 'typesafe-actions';
import { DurationInSeconds, IntervalInMilliseconds, TimeInMilliseconds, TimeRange } from '../types/Common';
import { ActionKeys } from './ActionKeys';

export const UserSettingsActions = {
  navCollapse: createAction(ActionKeys.NAV_COLLAPSE, resolve => (collapsed: boolean) =>
    resolve({ collapse: collapsed })
  ),
  setDuration: createStandardAction(ActionKeys.SET_DURATION)<DurationInSeconds>(),
  setTimeRange: createStandardAction(ActionKeys.SET_TIME_RANGE)<TimeRange>(),
  setRefreshInterval: createStandardAction(ActionKeys.SET_REFRESH_INTERVAL)<IntervalInMilliseconds>(),
  setReplayQueryTime: createStandardAction(ActionKeys.SET_REPLAY_QUERY_TIME)<TimeInMilliseconds>(),
  toggleReplayActive: createAction(ActionKeys.TOGGLE_REPLAY_ACTIVE)
};

export type UserSettingsAction = ActionType<typeof UserSettingsActions>;
