import { getType } from 'typesafe-actions';
import { LoginState as LoginStateInterface, LoginStatus } from '../store/Store';
import { KialiAppAction } from '../actions/KialiAppAction';
import { LoginActions } from '../actions/LoginActions';

export const INITIAL_LOGIN_STATE: LoginStateInterface = {
  status: LoginStatus.loggedOut,
  session: undefined,
  message: ''
};

// This Reducer allows changes to the 'loginState' portion of Redux Store
const loginState = (state: LoginStateInterface = INITIAL_LOGIN_STATE, action: KialiAppAction): LoginStateInterface => {
  switch (action.type) {
    case getType(LoginActions.loginRequest):
      return { ...INITIAL_LOGIN_STATE, status: LoginStatus.logging };
    case getType(LoginActions.loginSuccess):
      return { ...INITIAL_LOGIN_STATE, ...action.payload };
    case getType(LoginActions.loginExtend):
      return {
        ...INITIAL_LOGIN_STATE,
        status: LoginStatus.loggedIn,
        session: action.payload.session
      };
    case getType(LoginActions.loginFailure):
      let message = 'Error connecting to Kiali';

      if (action.payload.error.request.status === 401) {
        message = 'Unauthorized. Error in username or password';
      } else if (action.payload.error.request.status === 520) {
        message =
          'The Kiali secret is missing. Users are prohibited from accessing Kiali until an administrator creates a valid secret and restarts Kiali. Please refer to the Kiali documentation for more details.';
      }

      return { ...INITIAL_LOGIN_STATE, status: LoginStatus.error, message: message };
    case getType(LoginActions.logoutSuccess):
      return INITIAL_LOGIN_STATE;
    case getType(LoginActions.sessionExpired):
      return {
        ...INITIAL_LOGIN_STATE,
        status: LoginStatus.expired
      };
    default:
      return state;
  }
};

export default loginState;
