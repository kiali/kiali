import { ActionType, createAction } from 'typesafe-actions';
import * as API from '../services/Api';
import { Token } from '../store/Store';
import { HTTP_CODES } from '../types/Common';
import { HelpDropdownThunkActions } from './HelpDropdownActions';
import { GrafanaThunkActions } from './GrafanaActions';
import { config, setServerConfig, ServerConfig } from '../config';

enum LoginActionKeys {
  LOGIN_REQUEST = 'LOGIN_REQUEST',
  LOGIN_EXTEND = 'LOGIN_EXTEND',
  LOGIN_SUCCESS = 'LOGIN_SUCCESS',
  LOGIN_FAILURE = 'LOGIN_FAILURE',
  LOGOUT_SUCCESS = 'LOGOUT_SUCCESS'
}

export interface LoginPayload {
  logged?: boolean;
  sessionTimeOut?: number;
  token: Token;
  username: string;
}

export interface LoginFailurePayload {
  error: any;
}

// synchronous action creators
export const LoginActions = {
  loginRequest: createAction(LoginActionKeys.LOGIN_REQUEST),
  loginExtend: createAction(
    LoginActionKeys.LOGIN_EXTEND,
    resolve => (token: Token, username: string, currentTimeOut: number) =>
      resolve({
        token: token,
        username: username,
        sessionTimeOut: currentTimeOut + config().session.extendedSessionTimeOut
      } as LoginPayload)
  ),
  loginSuccess: createAction(
    LoginActionKeys.LOGIN_SUCCESS,
    resolve => (token: Token, username: string, currentTimeOut?: number) =>
      resolve({
        token: token,
        username: username,
        logged: true,
        sessionTimeOut: currentTimeOut || new Date().getTime() + config().session.sessionTimeOut
      } as LoginPayload)
  ),
  loginFailure: createAction(LoginActionKeys.LOGIN_FAILURE, resolve => (error: any) =>
    resolve({ error: error } as LoginFailurePayload)
  ),
  logoutSuccess: createAction(LoginActionKeys.LOGOUT_SUCCESS, resolve => () =>
    resolve({ logged: false } as LoginPayload)
  )
};

const performLogin = (dispatch: any, username?: string, password?: string) => {
  dispatch(LoginActions.loginRequest());

  let anonymous = username === undefined;
  let loginUser: string = username === undefined ? 'anonymous' : username;
  let loginPass: string = password === undefined ? 'anonymous' : password;

  API.login(loginUser, loginPass).then(
    token => {
      dispatch(LoginActions.loginSuccess(token['data'], loginUser));
      dispatch(HelpDropdownThunkActions.refresh());
    },
    error => {
      if (anonymous) {
        dispatch(LoginActions.logoutSuccess());
      } else {
        dispatch(LoginActions.loginFailure(error));
      }
    }
  );
};

export const LoginThunkActions = {
  extendSession: () => {
    return (dispatch, getState) => {
      const actualState = getState() || {};
      dispatch(
        LoginActions.loginExtend(
          actualState.authentication.token,
          actualState.authentication.username,
          actualState.authentication.sessionTimeOut
        )
      );
    };
  },
  checkCredentials: () => {
    return (dispatch, getState) => {
      const actualState = getState() || {};
      /** Check if there is a token in session */
      if (actualState['authentication']['token'] === undefined) {
        /** log in as anonymous user - this will logout the user if no anonymous access is allowed */
        performLogin(dispatch);
      } else {
        /** Check the session timeout */
        if (new Date().getTime() > getState().authentication.sessionTimeOut) {
          // if anonymous access is allowed, re-login automatically; otherwise, log out
          performLogin(dispatch);
        } else {
          /** Get the token storage in redux-store */
          const token = getState().authentication.token.token;
          /** Check if the token is valid */
          const auth = `Bearer ${token}`;
          API.getServerConfig(auth).then(
            response => {
              /** Login success */
              dispatch(
                LoginActions.loginSuccess(
                  actualState['authentication']['token'],
                  actualState['authentication']['username'],
                  actualState['authentication']['sessionTimeOut']
                )
              );
              dispatch(HelpDropdownThunkActions.refresh());
              dispatch(GrafanaThunkActions.getInfo(auth));
              const serverConfig: ServerConfig = {
                istioNamespace: response.data.istioNamespace,
                istioLabels: response.data.istioLabels
              };
              setServerConfig(serverConfig);
            },
            error => {
              /** Logout user */
              if (error.response && error.response.status === HTTP_CODES.UNAUTHORIZED) {
                dispatch(LoginActions.logoutSuccess());
              }
            }
          );
        }
      }
    };
  },
  // action creator that performs the async request
  authenticate: (username: string, password: string) => {
    return dispatch => performLogin(dispatch, username, password);
  }
};

export type LoginAction = ActionType<typeof LoginActions>;
