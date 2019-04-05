import moment from 'moment';
import { KialiAppState, LoginSession, LoginState } from '../store/Store';
import { LoginActions } from './LoginActions';
import * as API from '../services/Api';
import * as Login from '../services/Login';
import { AuthResult, AuthStrategy } from '../types/Auth';
import { KialiDispatch } from '../types/Redux';
import { MessageCenterActions } from './MessageCenterActions';
import authenticationConfig from '../config/AuthenticationConfig';

const Dispatcher = new Login.LoginDispatcher();

const shouldRelogin = (state?: LoginState): boolean =>
  !state || !state.session || moment(state.session!.expiresOn).diff(moment()) > 0;

const loginSuccess = async (dispatch: KialiDispatch, session: LoginSession) => {
  dispatch(LoginActions.loginSuccess(session));
};

// Performs the user login, dispatching to the proper login implementations.
// The `data` argument is defined as `any` because the dispatchers receive
// different kinds of data (such as e-mail/password, tokens).
const performLogin = (dispatch: KialiDispatch, state: KialiAppState, data?: any) => {
  const bail = (loginResult: Login.LoginResult) => {
    if (authenticationConfig.strategy === AuthStrategy.openshift) {
      dispatch(LoginActions.loginFailure(loginResult.error));
    } else {
      data ? dispatch(LoginActions.loginFailure(loginResult.error)) : dispatch(LoginActions.logoutSuccess());
    }
  };

  Dispatcher.prepare().then((result: AuthResult) => {
    if (result === AuthResult.CONTINUE) {
      Dispatcher.perform({ dispatch, state, data }).then(
        loginResult => loginSuccess(dispatch, loginResult.session!),
        error => bail(error)
      );
    } else {
      bail({ status: AuthResult.FAILURE, error: 'Preparation for login failed, try again.' });
    }
  });
};

const LoginThunkActions = {
  authenticate: (username: string, password: string) => {
    return (dispatch: KialiDispatch, getState: () => KialiAppState) => {
      dispatch(LoginActions.loginRequest());
      performLogin(dispatch, getState(), { username, password });
    };
  },
  checkCredentials: () => {
    return (dispatch: KialiDispatch, getState: () => KialiAppState) => {
      // If Openshift login strategy is enabled, or anonymous mode is enabled,
      // perform the login cycle. Else, it doesn't make sense to login with
      // blank credentials.
      if (authenticationConfig.strategy !== AuthStrategy.login) {
        const state: KialiAppState = getState();

        dispatch(LoginActions.loginRequest());

        if (shouldRelogin(state.authentication)) {
          performLogin(dispatch, state);
        } else {
          loginSuccess(dispatch, state.authentication!.session!);
        }
      }
    };
  },
  extendSession: (session: LoginSession) => {
    return (dispatch: KialiDispatch) => {
      dispatch(LoginActions.loginExtend(session));
    };
  },
  logout: () => {
    return async (dispatch: KialiDispatch) => {
      try {
        const response = await API.logout();

        if (response.status === 204) {
          dispatch(LoginActions.logoutSuccess());
        }
      } catch (err) {
        dispatch(MessageCenterActions.addMessage(API.getErrorMsg('Logout failed', err)));
      }
    };
  }
};

export default LoginThunkActions;
