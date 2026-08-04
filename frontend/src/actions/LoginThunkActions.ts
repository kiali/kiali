import moment from 'moment';
import type { KialiAppState, LoginSession, LoginState } from '../store/Store';
import { LoginActions } from './LoginActions';
import * as API from '../services/Api';
import * as Login from '../services/Login';
import { AuthResult } from '../types/Auth';
import type { KialiDispatch } from '../types/Redux';
import { isAuthStrategyOAuth } from '../config/AuthenticationConfig';
import { addError } from '../utils/AlertUtils';

const Dispatcher = new Login.LoginDispatcher();

const shouldRelogin = (state?: LoginState): boolean =>
  !state || !state.session || moment(state.session!.expiresOn).diff(moment()) > 0;

const loginSuccess = async (dispatch: KialiDispatch, session: LoginSession): Promise<void> => {
  dispatch(LoginActions.loginSuccess(session));
};

// Performs the user login, dispatching to the proper login implementations.
// The `data` argument is defined as `any` because the dispatchers receive
// different kinds of data (such as e-mail/password, tokens).
const performLogin = (dispatch: KialiDispatch, state: KialiAppState, data?: any): void => {
  const bail = (loginResult: Login.LoginResult): void => {
    if (isAuthStrategyOAuth()) {
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

export const LoginThunkActions = {
  authenticate: (username: string, password: string) => {
    return (dispatch: KialiDispatch, getState: () => KialiAppState): void => {
      dispatch(LoginActions.loginRequest());
      performLogin(dispatch, getState(), { username, password });
    };
  },
  checkCredentials: () => {
    return (dispatch: KialiDispatch, getState: () => KialiAppState): void => {
      const state: KialiAppState = getState();

      dispatch(LoginActions.loginRequest());

      if (shouldRelogin(state.authentication)) {
        performLogin(dispatch, state);
      } else {
        loginSuccess(dispatch, state.authentication!.session!);
      }
    };
  },
  extendSession: (session: LoginSession) => {
    return (dispatch: KialiDispatch): void => {
      dispatch(LoginActions.loginExtend(session));
    };
  },
  logout: () => {
    return async (dispatch: KialiDispatch): Promise<void> => {
      try {
        const response = await API.logout();

        if (response.status === 200 && response.data?.redirect_url) {
          window.location.href = response.data.redirect_url;
        } else {
          dispatch(LoginActions.logoutSuccess());
        }
      } catch (err) {
        if (err instanceof Error) {
          addError('Logout failed', err);
        }
      }
    };
  }
};
