import moment from 'moment';

import { getType } from 'typesafe-actions';
import { LoginState as LoginStateInterface, LoginStatus } from '../store/Store';
import { KialiAppAction } from '../actions/KialiAppAction';
import { LoginActions } from '../actions/LoginActions';

export const INITIAL_LOGIN_STATE: LoginStateInterface = {
  status: LoginStatus.loggedOut,
  session: undefined,
  message: '',
  // We define a small expiration date for the UI so it does not block the
  // session handling on login.
  uiExpiresOn: moment()
    .add(10, 'minute')
    .toISOString()
};

// This Reducer allows changes to the 'loginState' portion of Redux Store
const loginState = (state: LoginStateInterface = INITIAL_LOGIN_STATE, action: KialiAppAction): LoginStateInterface => {
  switch (action.type) {
    case getType(LoginActions.loginRequest):
      return Object.assign({}, INITIAL_LOGIN_STATE, {
        status: LoginStatus.logging
      });
    case getType(LoginActions.loginSuccess):
      return Object.assign({}, INITIAL_LOGIN_STATE, action.payload);
    case getType(LoginActions.loginExtend):
      return Object.assign({}, INITIAL_LOGIN_STATE, {
        status: LoginStatus.loggedIn,
        session: action.payload.session,
        uiExpiresOn: action.payload.uiExpiresOn
      });
    case getType(LoginActions.loginFailure):
      let message = 'Error connecting to Kiali';

      if (action.payload.error.request.status === 401) {
        message = 'Unauthorized. Error in username or password';
      } else if (action.payload.error.request.status === 520) {
        message =
          'The Kiali secret is missing. Users are prohibited from accessing Kiali until an administrator creates a valid secret and restarts Kiali. Please refer to the Kiali documentation for more details.';
      }

      return Object.assign({}, INITIAL_LOGIN_STATE, {
        status: LoginStatus.error,
        message: message
      });
    case getType(LoginActions.logoutSuccess):
      return INITIAL_LOGIN_STATE;
    default:
      return state;
  }
};

export default loginState;
