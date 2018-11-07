import { UserSettings } from '../store/Store';
import { UserSettingsActionKeys } from '../actions/UserSettingsActions';
import { config } from '../config';
import { updateState } from '../utils/Reducer';

export const INITIAL_USER_SETTINGS_STATE: UserSettings = {
  interface: { navCollapse: false },
  duration: config().toolbar.defaultDuration,
  refreshInterval: config().toolbar.defaultPollInterval
};

const UserSettingsState = (state: UserSettings = INITIAL_USER_SETTINGS_STATE, action) => {
  switch (action.type) {
    case UserSettingsActionKeys.NAV_COLLAPSE:
      return updateState(state, {
        interface: { navCollapse: action.collapse }
      });
    case UserSettingsActionKeys.SET_DURATION:
      return updateState(state, {
        duration: action.payload
      });
    case UserSettingsActionKeys.SET_REFRESH_INTERVAL:
      return updateState(state, {
        refreshInterval: action.payload
      });
    default:
      return state;
  }
};

export default UserSettingsState;
