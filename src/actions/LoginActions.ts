import { createAction } from 'typesafe-actions';
import * as API from '../services/Api';
import { Token } from '../store/Store';
import { HTTP_CODES } from '../types/Common';
import { HelpDropdownActions } from './HelpDropdownActions';
import { GrafanaActions } from './GrafanaActions';
import { config } from '../config';

export enum LoginActionKeys {
  LOGIN_REQUEST = 'LOGIN_REQUEST',
  LOGIN_EXTEND = 'LOGIN_EXTEND',
  LOGIN_SUCCESS = 'LOGIN_SUCCESS',
  LOGIN_FAILURE = 'LOGIN_FAILURE',
  LOGOUT_SUCCESS = 'LOGOUT_SUCCESS'
}

// synchronous action creators
export const LoginActions = {
  loginRequest: createAction(LoginActionKeys.LOGIN_REQUEST),
  loginExtend: createAction(LoginActionKeys.LOGIN_EXTEND, (token: Token, username: string, currentTimeOut: number) => ({
    type: LoginActionKeys.LOGIN_EXTEND,
    token: token,
    username: username,
    sessionTimeOut: currentTimeOut + config().session.extendedSessionTimeOut
  })),
  loginSuccess: createAction(
    LoginActionKeys.LOGIN_SUCCESS,
    (token: Token, username: string, currentTimeOut?: number) => ({
      type: LoginActionKeys.LOGIN_SUCCESS,
      token: token,
      username: username,
      logged: true,
      sessionTimeOut: currentTimeOut || new Date().getTime() + config().session.sessionTimeOut
    })
  ),
  loginFailure: createAction(LoginActionKeys.LOGIN_FAILURE, (error: any) => ({
    type: LoginActionKeys.LOGIN_FAILURE,
    error: error
  })),
  logoutSuccess: createAction(LoginActionKeys.LOGOUT_SUCCESS, () => ({
    type: LoginActionKeys.LOGOUT_SUCCESS,
    token: undefined,
    username: undefined,
    logged: false
  })),
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
        /** Logout user */
        dispatch(LoginActions.logoutSuccess());
      } else {
        /** Check the session timeout */
        if (new Date().getTime() > getState().authentication.sessionTimeOut) {
          dispatch(LoginActions.logoutSuccess());
        } else {
          /** Get the token storage in redux-store */
          const token = getState().authentication.token.token;
          /** Check if the token is valid */
          const auth = `Bearer ${token}`;
          API.getNamespaces(auth).then(
            status => {
              /** Login success */
              dispatch(
                LoginActions.loginSuccess(
                  actualState['authentication']['token'],
                  actualState['authentication']['username'],
                  actualState['authentication']['sessionTimeOut']
                )
              );
              dispatch(HelpDropdownActions.refresh());
              dispatch(GrafanaActions.getInfo(auth));
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
    return dispatch => {
      dispatch(LoginActions.loginRequest());
      API.login(username, password).then(
        token => {
          dispatch(LoginActions.loginSuccess(token['data'], username));
          dispatch(HelpDropdownActions.refresh());
        },
        error => {
          dispatch(LoginActions.loginFailure(error));
        }
      );
    };
  }
};
