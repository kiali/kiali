import { ThunkDispatch } from 'redux-thunk';
import { HTTP_CODES } from '../types/Common';
import { KialiAppState, Token, ServerConfig } from '../store/Store';
import { KialiAppAction } from './KialiAppAction';
import HelpDropdownThunkActions from './HelpDropdownThunkActions';
import GrafanaThunkActions from './GrafanaThunkActions';
import { LoginActions } from './LoginActions';
import * as API from '../services/Api';
import { ServerConfigActions } from './ServerConfigActions';

const ANONYMOUS: string = 'anonymous';

// completeLogin performs any initialization required prior to declaring the login complete. This
// prevents early rendering for components waiting on a login.
const completeLogin = (
  dispatch: ThunkDispatch<KialiAppState, void, KialiAppAction>,
  token: Token,
  username: string,
  timeout?: number
) => {
  const auth = `Bearer ${token['token']}`;
  API.getServerConfig(auth).then(
    response => {
      // set the serverConfig before completing login so that it is available for
      // anything needing it to render properly.
      const serverConfig: ServerConfig = {
        istioNamespace: response.data.istioNamespace,
        istioLabels: response.data.istioLabels,
        prometheus: response.data.prometheus
      };
      dispatch(ServerConfigActions.setServerConfig(serverConfig));

      // complete the login process
      dispatch(LoginActions.loginSuccess(token, username, timeout));

      // dispatch requests to be done now but not necessarily requiring immediate completion
      dispatch(HelpDropdownThunkActions.refresh());
      dispatch(GrafanaThunkActions.getInfo(auth));
    },
    error => {
      /** Logout user */
      if (error.response && error.response.status === HTTP_CODES.UNAUTHORIZED) {
        dispatch(LoginActions.logoutSuccess());
      }
    }
  );
};

// performLogin performs only the authentication part of login. If successful
// we call completeLogin to perform any initialization required for the user session.
const performLogin = (
  dispatch: ThunkDispatch<KialiAppState, void, KialiAppAction>,
  username?: string,
  password?: string
) => {
  dispatch(LoginActions.loginRequest());

  const loginUser: string = username === undefined ? ANONYMOUS : username;
  const loginPass: string = password === undefined ? ANONYMOUS : password;

  API.login(loginUser, loginPass).then(
    token => {
      completeLogin(dispatch, token['data'], loginUser);
    },
    error => {
      if (loginUser === ANONYMOUS) {
        dispatch(LoginActions.logoutSuccess());
      } else {
        dispatch(LoginActions.loginFailure(error));
      }
    }
  );
};

const LoginThunkActions = {
  extendSession: () => {
    return (dispatch: ThunkDispatch<KialiAppState, void, KialiAppAction>, getState: () => KialiAppState) => {
      const actualState = getState() || {};
      dispatch(
        LoginActions.loginExtend(
          actualState.authentication.token!,
          actualState.authentication.username!,
          actualState.authentication.sessionTimeOut!
        )
      );
    };
  },
  checkCredentials: () => {
    return (dispatch: ThunkDispatch<KialiAppState, void, KialiAppAction>, getState: () => KialiAppState) => {
      const actualState = getState() || {};
      const token = actualState['authentication']['token'];
      const username = actualState['authentication']['username'];
      const sessionTimeout = actualState['authentication']['sessionTimeOut'];

      /** Check if there is a token in session */
      if (!token) {
        /** log in as anonymous user - this will logout the user if no anonymous access is allowed */
        performLogin(dispatch);
      } else {
        /** Check the session timeout */
        if (new Date().getTime() > sessionTimeout!) {
          // if anonymous access is allowed, re-login automatically; otherwise, log out
          performLogin(dispatch);
        } else {
          completeLogin(dispatch, token, username!, sessionTimeout!);
        }
      }
    };
  },
  // action creator that performs the async request
  authenticate: (username: string, password: string) => {
    return (dispatch: ThunkDispatch<KialiAppState, void, KialiAppAction>) => performLogin(dispatch, username, password);
  }
};

export default LoginThunkActions;
