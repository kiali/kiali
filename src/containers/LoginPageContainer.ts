import { connect } from 'react-redux';
import { ThunkDispatch } from 'redux-thunk';
import LoginPage from '../pages/Login/LoginPage';
import { KialiAppState } from '../store/Store';
import { KialiAppAction } from '../actions/KialiAppAction';
import LoginThunkActions from '../actions/LoginThunkActions';

const mapStateToProps = (state: KialiAppState) => ({
  token: state.authentication.token,
  username: state.authentication.username,
  logging: state.authentication.logging,
  error: state.authentication.error,
  message: state.authentication.message
});

const mapDispatchToProps = (dispatch: ThunkDispatch<KialiAppState, void, KialiAppAction>) => ({
  authenticate: (username: string, password: string) => dispatch(LoginThunkActions.authenticate(username, password))
});

const LoginPageConnected = connect(
  mapStateToProps,
  mapDispatchToProps
)(LoginPage);
export default LoginPageConnected;
