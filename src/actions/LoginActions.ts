import { createAction } from 'typesafe-actions';
import * as API from '../services/Api';
import { Token } from '../store/Store';
import { HTTP_CODES } from '../types/Common';
import { HelpDropdownActions } from './HelpDropdownActions';

export enum LoginActionKeys {
  LOGIN_REQUEST = 'LOGIN_REQUEST',
  LOGIN_SUCCESS = 'LOGIN_SUCCESS',
  LOGIN_FAILURE = 'LOGIN_FAILURE',
  LOGOUT_SUCCESS = 'LOGOUT_SUCCESS'
}

// synchronous action creators
export const LoginActions = {
  loginRequest: createAction(LoginActionKeys.LOGIN_REQUEST),
  loginSuccess: createAction(LoginActionKeys.LOGIN_SUCCESS, (token: Token, username: string) => ({
    type: LoginActionKeys.LOGIN_SUCCESS,
    token: token,
    username: username,
    logged: true
  })),
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
  checkCredentials: () => {
    return (dispatch, getState) => {
      const actualState = getState() || {};
      const token =
        actualState['authentication']['token'] !== undefined ? getState().authentication.token.token || '' : '';
      const auth = `Bearer ${token}`;
      API.getNamespaces(auth).then(
        status => {
          dispatch(
            LoginActions.loginSuccess(actualState['authentication']['token'], actualState['authentication']['username'])
          );
        },
        error => {
          if (error.response && error.response.status === HTTP_CODES.UNAUTHORIZED) {
            dispatch(LoginActions.logoutSuccess());
          }
        }
      );
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
