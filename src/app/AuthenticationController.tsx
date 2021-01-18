import * as React from 'react';
import { connect } from 'react-redux';
import { bindActionCreators } from 'redux';
import authenticationConfig, { isAuthStrategyOAuth } from '../config/AuthenticationConfig';
import { KialiAppState, LoginStatus } from '../store/Store';
import * as API from '../services/Api';
import { HelpDropdownActions } from '../actions/HelpDropdownActions';
import { JaegerActions } from '../actions/JaegerActions';
import LoginThunkActions from '../actions/LoginThunkActions';
import { MessageCenterActions } from '../actions/MessageCenterActions';
import { MessageType } from '../types/MessageCenter';
import { KialiDispatch } from '../types/Redux';
import { ServerStatus } from '../types/ServerStatus';
import InitializingScreen from './InitializingScreen';
import { isKioskMode } from '../utils/SearchParamUtils';
import * as AlertUtils from '../utils/AlertUtils';
import { setServerConfig } from '../config/ServerConfig';
import { TLSStatus } from '../types/TLSStatus';
import { MeshTlsActions } from '../actions/MeshTlsActions';
import { AuthStrategy } from '../types/Auth';
import { JaegerInfo } from '../types/JaegerInfo';
import { LoginActions } from '../actions/LoginActions';
import history from './History';

interface AuthenticationControllerReduxProps {
  authenticated: boolean;
  checkCredentials: () => void;
  isLoginError: boolean;
  landingRoute?: string;
  setJaegerInfo: (jaegerInfo: JaegerInfo | null) => void;
  setLandingRoute: (route: string | undefined) => void;
  setMeshTlsStatus: (meshStatus: TLSStatus) => void;
  setServerStatus: (serverStatus: ServerStatus) => void;
}

type AuthenticationControllerProps = AuthenticationControllerReduxProps & {
  protectedAreaComponent: React.ReactNode;
  publicAreaComponent: (isPostLoginPerforming: boolean, errorMsg?: string) => React.ReactNode;
};

enum LoginStage {
  LOGIN,
  POST_LOGIN,
  LOGGED_IN,
  LOGGED_IN_AT_LOAD
}

interface AuthenticationControllerState {
  stage: LoginStage;
  isPostLoginError: boolean;
}

class AuthenticationController extends React.Component<AuthenticationControllerProps, AuthenticationControllerState> {
  static readonly PostLoginErrorMsg =
    'You are logged in, but there was a problem when fetching some required server ' +
    'configurations. Please, try refreshing the page.';

  constructor(props: AuthenticationControllerProps) {
    super(props);
    this.state = {
      stage: this.props.authenticated ? LoginStage.LOGGED_IN_AT_LOAD : LoginStage.LOGIN,
      isPostLoginError: false
    };
  }

  componentDidMount(): void {
    if (this.state.stage === LoginStage.LOGGED_IN_AT_LOAD) {
      this.doPostLoginActions();
    } else {
      let dispatchLoginCycleOnLoad = false;

      // If login strategy is "anonymous" or "header", dispatch login cycle
      // because there is no need to ask for any credentials
      if (
        authenticationConfig.strategy === AuthStrategy.anonymous ||
        authenticationConfig.strategy === AuthStrategy.header
      ) {
        dispatchLoginCycleOnLoad = true;
      }

      // If login strategy is Openshift, OpenId, check if there is an
      // "access_token" or "id_token" hash parameter in the URL. If there is,
      // this means the IdP is calling back. Dispatch the login cycle to finish
      // the authentication.
      if (isAuthStrategyOAuth()) {
        const pattern = /[#&](access_token|id_token)=/;
        dispatchLoginCycleOnLoad = pattern.test(window.location.hash);
      }

      if (dispatchLoginCycleOnLoad) {
        this.props.checkCredentials();

        // This state shows the initializing screen while doing the login cycle. This
        // prevents from briefly showing the login form while the trip to the back-end completes.
        this.setState({
          stage: LoginStage.LOGGED_IN_AT_LOAD
        });
      } else {
        this.props.setLandingRoute(history.location.pathname + history.location.search);
      }
    }

    this.setDocLayout();
  }

  componentDidUpdate(
    prevProps: Readonly<AuthenticationControllerProps>,
    _prevState: Readonly<AuthenticationControllerState>
  ): void {
    if (!prevProps.authenticated && this.props.authenticated) {
      this.setState({ stage: LoginStage.POST_LOGIN });
      this.doPostLoginActions();
    } else if (prevProps.authenticated && !this.props.authenticated) {
      this.setState({ stage: LoginStage.LOGIN });
    }

    if (!prevProps.isLoginError && this.props.isLoginError) {
      this.setState({ stage: LoginStage.LOGIN });
    }

    this.setDocLayout();
  }

  render() {
    if (this.state.stage === LoginStage.LOGGED_IN) {
      return this.props.protectedAreaComponent;
    } else if (this.state.stage === LoginStage.LOGGED_IN_AT_LOAD) {
      return !this.state.isPostLoginError ? (
        <InitializingScreen />
      ) : (
        <InitializingScreen errorMsg={AuthenticationController.PostLoginErrorMsg} />
      );
    } else if (this.state.stage === LoginStage.POST_LOGIN) {
      // For OAuth/OpenID auth strategies, show/keep the initializing screen unless there
      // is an error.
      if (!this.state.isPostLoginError && isAuthStrategyOAuth()) {
        return <InitializingScreen />;
      }

      return !this.state.isPostLoginError
        ? this.props.publicAreaComponent(true)
        : this.props.publicAreaComponent(false, AuthenticationController.PostLoginErrorMsg);
    } else {
      return this.props.publicAreaComponent(false);
    }
  }

  private doPostLoginActions = async () => {
    try {
      const getStatusPromise = API.getStatus()
        .then(response => this.props.setServerStatus(response.data))
        .catch(error => {
          AlertUtils.addError('Error fetching server status.', error, 'default', MessageType.WARNING);
        });
      const getJaegerInfoPromise = API.getJaegerInfo()
        .then(response => this.props.setJaegerInfo(response.data))
        .catch(error => {
          this.props.setJaegerInfo(null);
          AlertUtils.addError(
            'Could not fetch Jaeger info. Turning off Jaeger integration.',
            error,
            'default',
            MessageType.INFO
          );
        });

      const configs = await Promise.all([API.getServerConfig(), getStatusPromise, getJaegerInfoPromise]);
      setServerConfig(configs[0].data);

      if (this.props.landingRoute) {
        history.replace(this.props.landingRoute);
        this.props.setLandingRoute(undefined);
      }
      this.setState({ stage: LoginStage.LOGGED_IN });
    } catch (err) {
      console.error('Error on post-login actions.', err);
      this.setState({ isPostLoginError: true });
    }
  };

  private setDocLayout = () => {
    if (document.documentElement) {
      document.documentElement.className = isKioskMode() ? 'kiosk' : '';
    }
  };
}

const processServerStatus = (dispatch: KialiDispatch, serverStatus: ServerStatus) => {
  dispatch(
    HelpDropdownActions.statusRefresh(serverStatus.status, serverStatus.externalServices, serverStatus.warningMessages)
  );

  serverStatus.warningMessages.forEach(wMsg => {
    dispatch(MessageCenterActions.addMessage(wMsg, '', 'systemErrors', MessageType.WARNING));
  });
};

const mapStateToProps = (state: KialiAppState) => ({
  authenticated: state.authentication.status === LoginStatus.loggedIn,
  isLoginError: state.authentication.status === LoginStatus.error,
  landingRoute: state.authentication.landingRoute
});

const mapDispatchToProps = (dispatch: KialiDispatch) => ({
  checkCredentials: () => dispatch(LoginThunkActions.checkCredentials()),
  setJaegerInfo: bindActionCreators(JaegerActions.setInfo, dispatch),
  setLandingRoute: bindActionCreators(LoginActions.setLandingRoute, dispatch),
  setMeshTlsStatus: bindActionCreators(MeshTlsActions.setinfo, dispatch),
  setServerStatus: (serverStatus: ServerStatus) => processServerStatus(dispatch, serverStatus)
});

const AuthenticationControllerContainer = connect(mapStateToProps, mapDispatchToProps)(AuthenticationController);
export default AuthenticationControllerContainer;
