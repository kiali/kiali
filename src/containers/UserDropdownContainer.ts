import { KialiAppState } from '../store/Store';
import { connect } from 'react-redux';
import UserDropdown from '../components/Nav/UserDropdown';

import { LoginActions } from '../actions/LoginActions';

const mapStateToProps = (state: KialiAppState) => ({
  username: state.authentication.username
});

const mapDispatchToProps = (dispatch: any) => ({
  logout: () => dispatch(LoginActions.logoutSuccess())
});

const UserDropdownConnected = connect(
  mapStateToProps,
  mapDispatchToProps
)(UserDropdown);
export default UserDropdownConnected;
