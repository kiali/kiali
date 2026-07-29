import type { ActionType } from 'types/typesafeActionsLegacy';
import { createAction, createStandardAction } from 'types/typesafeActionsLegacy';
import type { LoginSession } from '../store/Store';
import { LoginStatus } from '../store/Store';
import { ActionKeys } from './ActionKeys';

export interface LoginPayload {
  error?: any;
  landingRoute?: string;
  session?: LoginSession;
  status: LoginStatus;
}

// synchronous action creators
export const LoginActions = {
  loginRequest: createAction(ActionKeys.LOGIN_REQUEST),
  loginExtend: createAction(ActionKeys.LOGIN_EXTEND, resolve => (session: LoginSession) =>
    resolve({
      status: LoginStatus.loggedIn,
      session: session,
      error: undefined
    } as LoginPayload)
  ),
  loginSuccess: createAction(ActionKeys.LOGIN_SUCCESS, resolve => (session: LoginSession) =>
    resolve({
      status: LoginStatus.loggedIn,
      session: session,
      error: undefined,
      uiExpiresOn: session.expiresOn
    } as LoginPayload)
  ),
  loginFailure: createAction(ActionKeys.LOGIN_FAILURE, resolve => (error: any) =>
    resolve({
      status: LoginStatus.error,
      session: undefined,
      error: error
    } as LoginPayload)
  ),
  logoutSuccess: createAction(ActionKeys.LOGOUT_SUCCESS, resolve => () =>
    resolve({
      status: LoginStatus.loggedOut,
      session: undefined,
      error: undefined
    } as LoginPayload)
  ),
  sessionExpired: createAction(ActionKeys.SESSION_EXPIRED),
  setLandingRoute: createStandardAction(ActionKeys.SET_LANDING_ROUTE)<string | undefined>()
};

export type LoginAction = ActionType<typeof LoginActions>;
