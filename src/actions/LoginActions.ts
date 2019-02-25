import { RawDate } from '../types/Common';

import { ActionType, createAction } from 'typesafe-actions';
import { LoginSession, LoginStatus } from '../store/Store';

enum LoginActionKeys {
  LOGIN_REQUEST = 'LOGIN_REQUEST',
  LOGIN_EXTEND = 'LOGIN_EXTEND',
  LOGIN_SUCCESS = 'LOGIN_SUCCESS',
  LOGIN_FAILURE = 'LOGIN_FAILURE',
  LOGOUT_SUCCESS = 'LOGOUT_SUCCESS'
}

export interface LoginPayload {
  status: LoginStatus;
  session?: LoginSession;
  error?: any;
  uiExpiresOn: RawDate;
}

// synchronous action creators
export const LoginActions = {
  loginRequest: createAction(LoginActionKeys.LOGIN_REQUEST),
  loginExtend: createAction(LoginActionKeys.LOGIN_EXTEND, resolve => (session: LoginSession) =>
    resolve({
      status: LoginStatus.loggedIn,
      session: session,
      error: undefined
    } as LoginPayload)
  ),
  loginSuccess: createAction(LoginActionKeys.LOGIN_SUCCESS, resolve => (session: LoginSession) =>
    resolve({
      status: LoginStatus.loggedIn,
      session: session,
      error: undefined,
      uiExpiresOn: session.expiresOn
    } as LoginPayload)
  ),
  loginFailure: createAction(LoginActionKeys.LOGIN_FAILURE, resolve => (error: any) =>
    resolve({
      status: LoginStatus.error,
      session: undefined,
      error: error
    } as LoginPayload)
  ),
  logoutSuccess: createAction(LoginActionKeys.LOGOUT_SUCCESS, resolve => () =>
    resolve({
      status: LoginStatus.loggedOut,
      session: undefined,
      error: undefined
    } as LoginPayload)
  )
};

export type LoginAction = ActionType<typeof LoginActions>;
