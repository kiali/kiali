import * as React from 'react';
import { connect } from 'react-redux';
import { bindActionCreators } from 'redux';
import { GrafanaInfo, JaegerState, KialiAppState, LoginStatus } from '../store/Store';
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
import { TLSStatus } from '../types/TLSStatus';
import { MeshTlsActions } from '../actions/MeshTlsActions';
import JaegerInfo from '../types/JaegerInfo';

interface AuthenticationControllerReduxProps {
  authenticated: boolean;
  setGrafanaInfo: (grafanaInfo: GrafanaInfo) => void;
  setJaegerInfo: (jaegerInfo: JaegerState) => void;
  setServerStatus: (serverStatus: ServerStatus) => void;
  setMeshTlsStatus: (meshStatus: TLSStatus) => void;
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
          MessageCenter.add(API.getErrorMsg('Error fetching status.', error), 'default', MessageType.WARNING);
        });
      const getGrafanaInfoPromise = API.getGrafanaInfo()
        .then(response => this.props.setGrafanaInfo(response.data))
        .catch(error => {
          MessageCenter.add(
            API.getErrorMsg('Could not fetch Grafana info. Turning off links to Grafana.', error),
            'default',
            MessageType.INFO
          );
        });
      const getJaegerInfoPromise = API.getJaegerInfo()
        .then(response => this.setJaegerInfo(response.data))
        .catch(error => {
          MessageCenter.add(
            API.getErrorMsg('Could not fetch Jaeger info. Turning off Jaeger integration.', error),
            'default',
            MessageType.INFO
          );
        });
      const getMeshTlsPromise = API.getMeshTls()
        .then(response => this.props.setMeshTlsStatus(response.data))
        .catch(error => {
          MessageCenter.add(API.getErrorMsg('Error fetching TLS Info.', error), 'default', MessageType.WARNING);
        });

      const configs = await Promise.all([
        API.getServerConfig(),
        getStatusPromise,
        getGrafanaInfoPromise,
        getJaegerInfoPromise,
        getMeshTlsPromise
      ]);
      setServerConfig(configs[0].data);

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

  private setJaegerInfo = (jaegerInfo: JaegerInfo) => {
    let jaegerState: JaegerState = { jaegerURL: '', enableIntegration: false };

    if (jaegerInfo.url) {
      jaegerState = {
        jaegerURL: jaegerInfo.url,
        // If same protocol enable integration, otherwise new tab is open
        enableIntegration: jaegerInfo.url.startsWith(window.location.protocol)
      };
    }

    this.props.setJaegerInfo(jaegerState);
  };
}

const processServerStatus = (dispatch: KialiDispatch, serverStatus: ServerStatus) => {
  dispatch(
    HelpDropdownActions.statusRefresh(serverStatus.status, serverStatus.externalServices, serverStatus.warningMessages)
  );

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
    setJaegerInfo: bindActionCreators(JaegerActions.setinfo, dispatch),
    setServerStatus: (serverStatus: ServerStatus) => processServerStatus(dispatch, serverStatus),
    setMeshTlsStatus: bindActionCreators(MeshTlsActions.setinfo, dispatch)
  };
};

const AuthenticationControllerContainer = connect(
  mapStateToProps,
  mapDispatchToProps
)(AuthenticationController);
export default AuthenticationControllerContainer;
