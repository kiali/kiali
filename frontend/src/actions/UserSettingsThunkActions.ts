import { KialiDispatch } from "../types/Redux";
import { UserSettingsActions } from './UserSettingsActions';

const UserSettingsThunkActions = {
  setNavCollapsed: (collapsed: boolean) => (dispatch: KialiDispatch) =>
    dispatch(UserSettingsActions.navCollapse(collapsed))
};

export default UserSettingsThunkActions;
