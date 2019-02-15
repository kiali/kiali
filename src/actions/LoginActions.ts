import { ActionType, createAction } from 'typesafe-actions';
import { Token } from '../store/Store';
import { config } from '../config/Config';

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

export type LoginAction = ActionType<typeof LoginActions>;
