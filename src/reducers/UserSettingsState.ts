import { getType } from 'typesafe-actions';
import { UserSettings } from '../store/Store';
import { config } from '../config';
import { updateState } from '../utils/Reducer';
import { KialiAppAction } from '../actions/KialiAppAction';
import { UserSettingsActions } from '../actions/UserSettingsActions';

export const INITIAL_USER_SETTINGS_STATE: UserSettings = {
  interface: { navCollapse: false },
  duration: config.toolbar.defaultDuration,
  refreshInterval: config.toolbar.defaultPollInterval
};

const UserSettingsState = (state: UserSettings = INITIAL_USER_SETTINGS_STATE, action: KialiAppAction): UserSettings => {
  switch (action.type) {
    case getType(UserSettingsActions.navCollapse):
      return updateState(state, {
        interface: { navCollapse: action.payload.collapse }
      });
    case getType(UserSettingsActions.setDuration):
      return updateState(state, {
        duration: action.payload
      });
    case getType(UserSettingsActions.setRefreshInterval):
      return updateState(state, {
        refreshInterval: action.payload
      });
    default:
      return state;
  }
};

export default UserSettingsState;
