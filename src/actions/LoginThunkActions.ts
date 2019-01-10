import { ThunkDispatch } from 'redux-thunk';
import { setServerConfig } from '../config';
import { HTTP_CODES } from '../types/Common';
import { KialiAppState } from '../store/Store';
import { KialiAppAction } from './KialiAppAction';
import HelpDropdownThunkActions from './HelpDropdownThunkActions';
import GrafanaThunkActions from './GrafanaThunkActions';
import { LoginActions } from './LoginActions';
import * as API from '../services/Api';
import { ServerConfig } from '../config/config';

const performLogin = (
  dispatch: ThunkDispatch<KialiAppState, void, KialiAppAction>,
  username?: string,
  password?: string
) => {
  dispatch(LoginActions.loginRequest());

  let anonymous = username === undefined;
  let loginUser: string = username === undefined ? 'anonymous' : username;
  let loginPass: string = password === undefined ? 'anonymous' : password;

  API.login(loginUser, loginPass).then(
    token => {
      dispatch(LoginActions.loginSuccess(token['data'], loginUser));
      const auth = `Bearer ${token['data']['token']}`;
      dispatch(HelpDropdownThunkActions.refresh());
      dispatch(GrafanaThunkActions.getInfo(auth));
    },
    error => {
      if (anonymous) {
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
      /** Check if there is a token in session */
      if (actualState['authentication']['token'] === undefined) {
        /** log in as anonymous user - this will logout the user if no anonymous access is allowed */
        performLogin(dispatch);
      } else {
        /** Check the session timeout */
        if (new Date().getTime() > getState().authentication.sessionTimeOut!) {
          // if anonymous access is allowed, re-login automatically; otherwise, log out
          performLogin(dispatch);
        } else {
          /** Get the token storage in redux-store */
          const token = getState().authentication.token!.token;
          /** Check if the token is valid */
          const auth = `Bearer ${token}`;
          API.getServerConfig(auth).then(
            response => {
              /** Login success */
              dispatch(
                LoginActions.loginSuccess(
                  actualState['authentication']['token']!,
                  actualState['authentication']['username']!,
                  actualState['authentication']['sessionTimeOut']!
                )
              );
              dispatch(HelpDropdownThunkActions.refresh());
              dispatch(GrafanaThunkActions.getInfo(auth));
              const serverConfig: ServerConfig = {
                istioNamespace: response.data.istioNamespace,
                istioLabels: response.data.istioLabels
              };
              setServerConfig(serverConfig);
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
    return (dispatch: ThunkDispatch<KialiAppState, void, KialiAppAction>) => performLogin(dispatch, username, password);
  }
};

export default LoginThunkActions;
