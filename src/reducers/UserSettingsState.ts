import { UserSettings } from '../store/Store';
import { UserSettingsActionKeys } from '../actions/UserSettingsActions';

export const INITIAL_USER_SETTINGS_STATE: UserSettings = {
  interface: { navCollapse: false }
};

const UserSettingsState = (state: UserSettings = INITIAL_USER_SETTINGS_STATE, action) => {
  switch (action.type) {
    case UserSettingsActionKeys.NAV_COLLAPSE:
      return Object.assign({}, INITIAL_USER_SETTINGS_STATE, {
        interface: { navCollapse: action.collapse }
      });
    default:
      return state;
  }
};

export default UserSettingsState;
