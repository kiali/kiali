import { connect } from 'react-redux';
import { ThunkDispatch } from 'redux-thunk';

import UserDropdown from '../components/Nav/UserDropdown';
import { KialiAppState } from '../store/Store';
import { KialiAppAction } from '../actions/KialiAppAction';
import { LoginActions } from '../actions/LoginActions';
import LoginThunkActions from '../actions/LoginThunkActions';

const mapStateToProps = (state: KialiAppState) => ({
  session: state.authentication.session!
});

const mapDispatchToProps = (dispatch: ThunkDispatch<KialiAppState, void, KialiAppAction>) => ({
  logout: () => dispatch(LoginActions.logoutSuccess()),
  extendSession: () => dispatch(LoginThunkActions.extendSession()),
  checkCredentials: () => dispatch(LoginThunkActions.checkCredentials())
});

const UserDropdownConnected = connect(
  mapStateToProps,
  mapDispatchToProps
)(UserDropdown);
export default UserDropdownConnected;
