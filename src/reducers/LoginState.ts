import { LoginState } from '../store/Store';
import { LoginActionKeys } from '../actions/LoginActions';

export const INITIAL_LOGIN_STATE: LoginState = {
  token: undefined,
  username: undefined,
  error: false,
  message: '',
  logged: false,
  logging: false,
  sessionTimeOut: undefined
};

// This Reducer allows changes to the 'LoginState' portion of Redux Store
const LoginState = (state: LoginState = INITIAL_LOGIN_STATE, action) => {
  switch (action.type) {
    case LoginActionKeys.LOGIN_REQUEST:
      return Object.assign({}, INITIAL_LOGIN_STATE, {
        logging: true
      });
    case LoginActionKeys.LOGIN_SUCCESS:
      return Object.assign({}, INITIAL_LOGIN_STATE, {
        logged: true,
        token: action.token,
        username: action.username,
        sessionTimeOut: action.sessionTimeOut
      });
    case LoginActionKeys.LOGIN_EXTEND:
      return Object.assign({}, INITIAL_LOGIN_STATE, {
        logged: true,
        token: action.token,
        username: action.username,
        sessionTimeOut: action.sessionTimeOut
      });
    case LoginActionKeys.LOGIN_FAILURE:
      let message = 'Error connecting to Kiali';
      if (action.error.request.status === 401) {
        message = 'Unauthorized. Error in username or password';
      }
      return Object.assign({}, INITIAL_LOGIN_STATE, {
        error: true,
        message: message
      });
    case LoginActionKeys.LOGOUT_SUCCESS:
      return INITIAL_LOGIN_STATE;
    default:
      return state;
  }
};

export default LoginState;
