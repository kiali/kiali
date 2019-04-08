import * as React from 'react';
import { connect } from 'react-redux';
import { bindActionCreators } from 'redux';
import { GrafanaInfo, KialiAppState, LoginStatus } from '../store/Store';
import * as API from '../services/Api';
import { HelpDropdownActions } from '../actions/HelpDropdownActions';
import { JaegerActions } from '../actions/JaegerActions';
import { MessageCenterActions } from '../actions/MessageCenterActions';
import { MessageType } from '../types/MessageCenter';
import { KialiDispatch } from '../types/Redux';
import { ServerStatus } from '../types/ServerStatus';
import { GrafanaActions } from '../actions/GrafanaActions';
import InitializingScreen from './InitializingScreen';
import { isKioskMode } from '../utils/SearchParamUtils';
import * as MessageCenter from '../utils/MessageCenter';
import { setServerConfig } from '../config/ServerConfig';

interface AuthenticationControllerReduxProps {
  authenticated: boolean;
  setGrafanaInfo: (grafanaInfo: GrafanaInfo) => void;
  setServerStatus: (serverStatus: ServerStatus) => void;
}

type AuthenticationControllerProps = AuthenticationControllerReduxProps & {
  protectedAreaComponent: React.ReactNode;
  publicAreaComponent: React.ReactNode;
};

interface AuthenticationControllerState {
  stage: 'login' | 'post-login' | 'logged-in';
  isPostLoginError: boolean;
}

class AuthenticationController extends React.Component<AuthenticationControllerProps, AuthenticationControllerState> {
  static readonly PostLoginErrorMsg =
    'You are logged in, but there was a problem when fetching some required server ' +
    'configurations. Please, try refreshing the page.';

  constructor(props: AuthenticationControllerProps) {
    super(props);
    this.state = {
      stage: this.props.authenticated ? 'post-login' : 'login',
      isPostLoginError: false
    };
  }

  componentDidMount(): void {
    if (this.state.stage === 'post-login') {
      this.doPostLoginActions();
    }

    this.setDocLayout();
  }

  componentDidUpdate(
    prevProps: Readonly<AuthenticationControllerProps>,
    prevState: Readonly<AuthenticationControllerState>
  ): void {
    if (!prevProps.authenticated && this.props.authenticated) {
      this.setState({ stage: 'post-login' });
      this.doPostLoginActions();
    } else if (prevProps.authenticated && !this.props.authenticated) {
      this.setState({ stage: 'login' });
    }

    this.setDocLayout();
  }

  render() {
    if (this.state.stage === 'logged-in') {
      return this.props.protectedAreaComponent;
    } else if (this.state.stage === 'post-login') {
      return !this.state.isPostLoginError ? (
        <InitializingScreen />
      ) : (
        <InitializingScreen errorMsg={AuthenticationController.PostLoginErrorMsg} />
      );
    } else {
      return this.props.publicAreaComponent;
    }
  }

  private doPostLoginActions = async () => {
    try {
      const getStatusPromise = API.getStatus()
        .then(response => this.props.setServerStatus(response.data))
        .catch(error => {
          MessageCenter.add(API.getErrorMsg('Error fetching status.', error), 'default', MessageType.WARNING);
        });
      const getGrafanaInfoPromise = API.getGrafanaInfo()
        .then(response => this.props.setGrafanaInfo(response.data))
        .catch(error => {
          MessageCenter.add(API.getErrorMsg('Error fetching Grafana Info.', error), 'default', MessageType.WARNING);
        });

      const configs = await Promise.all([API.getServerConfig(), getStatusPromise, getGrafanaInfoPromise]);
      setServerConfig(configs[0].data);

      this.setState({ stage: 'logged-in' });
    } catch (err) {
      console.error('Error on post-login actions.', err);
      this.setState({ isPostLoginError: true });
    }
  };

  private setDocLayout = () => {
    if (document.documentElement) {
      document.documentElement.className = this.state.stage === 'logged-in' ? 'layout-pf layout-pf-fixed' : 'login-pf';
      if (isKioskMode()) {
        document.documentElement.className += ' kiosk';
      }
    }
  };
}

const processServerStatus = (dispatch: KialiDispatch, serverStatus: ServerStatus) => {
  dispatch(
    HelpDropdownActions.statusRefresh(serverStatus.status, serverStatus.externalServices, serverStatus.warningMessages)
  );

  // Get the jaeger URL
  const hasJaeger = serverStatus.externalServices.filter(item => item.name === 'Jaeger');
  if (hasJaeger.length === 1 && hasJaeger[0].url) {
    dispatch(JaegerActions.setUrl(hasJaeger[0].url));
    // If same protocol enable integration
    dispatch(JaegerActions.setEnableIntegration(hasJaeger[0].url.startsWith(window.location.protocol)));
  }

  serverStatus.warningMessages.forEach(wMsg => {
    dispatch(MessageCenterActions.addMessage(wMsg, 'systemErrors', MessageType.WARNING));
  });
};

const mapStateToProps = (state: KialiAppState) => ({
  authenticated: state.authentication.status === LoginStatus.loggedIn
});

const mapDispatchToProps = (dispatch: KialiDispatch) => {
  return {
    setGrafanaInfo: bindActionCreators(GrafanaActions.setinfo, dispatch),
    setServerStatus: (serverStatus: ServerStatus) => processServerStatus(dispatch, serverStatus)
  };
};

const AuthenticationControllerContainer = connect(
  mapStateToProps,
  mapDispatchToProps
)(AuthenticationController);
export default AuthenticationControllerContainer;
