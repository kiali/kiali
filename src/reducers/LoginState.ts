import { getType } from 'typesafe-actions';
import { LoginState } from '../store/Store';
import { KialiAppAction } from '../actions/KialiAppAction';
import { LoginActions } from '../actions/LoginActions';

export const INITIAL_LOGIN_STATE: LoginState = {
  token: undefined,
  username: undefined,
  error: false,
  message: '',
  logged: false,
  logging: false,
  sessionTimeOut: undefined
};

// This Reducer allows changes to the 'loginState' portion of Redux Store
const loginState = (state: LoginState = INITIAL_LOGIN_STATE, action: KialiAppAction): LoginState => {
  switch (action.type) {
    case getType(LoginActions.loginRequest):
      return Object.assign({}, INITIAL_LOGIN_STATE, {
        logging: true
      });
    case getType(LoginActions.loginSuccess):
      return Object.assign({}, INITIAL_LOGIN_STATE, {
        logged: true,
        token: action.payload.token,
        username: action.payload.username,
        sessionTimeOut: action.payload.sessionTimeOut
      });
    case getType(LoginActions.loginExtend):
      return Object.assign({}, INITIAL_LOGIN_STATE, {
        logged: true,
        token: action.payload.token,
        username: action.payload.username,
        sessionTimeOut: action.payload.sessionTimeOut
      });
    case getType(LoginActions.loginFailure):
      let message = 'Error connecting to Kiali';
      if (action.payload.error.request.status === 401) {
        message = 'Unauthorized. Error in username or password';
      }
      return Object.assign({}, INITIAL_LOGIN_STATE, {
        error: true,
        message: message
      });
    case getType(LoginActions.logoutSuccess):
      return INITIAL_LOGIN_STATE;
    default:
      return state;
  }
};

export default loginState;
