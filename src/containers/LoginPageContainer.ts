import { KialiAppState } from '../store/Store';
import { connect } from 'react-redux';
import LoginPage from '../pages/Login/LoginPage';

import { LoginActions } from '../actions/LoginActions';

const mapStateToProps = (state: KialiAppState) => ({
  token: state.authentication.token,
  username: state.authentication.username,
  logging: state.authentication.logging,
  error: state.authentication.error,
  message: state.authentication.message
});

const mapDispatchToProps = (dispatch: any) => ({
  authenticate: (username: string, password: string) => dispatch(LoginActions.authenticate(username, password))
});

const LoginPageConnected = connect(mapStateToProps, mapDispatchToProps)(LoginPage);
export default LoginPageConnected;
