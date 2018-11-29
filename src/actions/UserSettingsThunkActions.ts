import { ThunkDispatch } from 'redux-thunk';
import { KialiAppState } from '../store/Store';
import { KialiAppAction } from './KialiAppAction';
import { UserSettingsActions } from './UserSettingsActions';

const UserSettingsThunkActions = {
  setNavCollapsed: (collapsed: boolean) => (dispatch: ThunkDispatch<KialiAppState, void, KialiAppAction>) =>
    dispatch(UserSettingsActions.navCollapse(collapsed))
};

export default UserSettingsThunkActions;
