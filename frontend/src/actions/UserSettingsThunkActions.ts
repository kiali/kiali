import { KialiDispatch } from '../types/Redux';
import { UserSettingsActions } from './UserSettingsActions';

export const UserSettingsThunkActions = {
  setNavCollapsed: (collapsed: boolean) => (dispatch: KialiDispatch) =>
    dispatch(UserSettingsActions.navCollapse(collapsed))
};
