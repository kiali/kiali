import { UserSettings } from '../store/Store';
import { UserSettingsActionKeys } from '../actions/UserSettingsActions';

const INITIAL_STATE: UserSettings = {
  interface: { navCollapse: false }
};

const UserSettingsState = (state: UserSettings = INITIAL_STATE, action) => {
  switch (action.type) {
    case UserSettingsActionKeys.NAV_COLLAPSE:
      return Object.assign({}, INITIAL_STATE, {
        interface: { navCollapse: action.collapse }
      });
    default:
      return state;
  }
};

export default UserSettingsState;
