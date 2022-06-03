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
import InitializingScreen from './InitializingScreen';
import {getKioskMode, isKioskMode} from '../utils/SearchParamUtils';
import * as AlertUtils from '../utils/AlertUtils';
import { setServerConfig, serverConfig, humanDurations } from '../config/ServerConfig';
import { TLSStatus } from '../types/TLSStatus';
import { MeshTlsActions } from '../actions/MeshTlsActions';
import { AuthStrategy } from '../types/Auth';
import { JaegerInfo } from '../types/JaegerInfo';
import { ServerConfig } from '../types/ServerConfig';
import { LoginActions } from '../actions/LoginActions';
import history from './History';
import { NamespaceActions } from 'actions/NamespaceAction';
import Namespace from 'types/Namespace';
import { UserSettingsActions } from 'actions/UserSettingsActions';
import { DurationInSeconds, IntervalInMilliseconds } from 'types/Common';
import { config } from 'config';
import { store } from 'store/ConfigStore';
import { toGrpcRate, toHttpRate, toTcpRate, TrafficRate } from 'types/Graph';
import { GraphToolbarActions } from 'actions/GraphToolbarActions';
import { StatusState, StatusKey } from 'types/StatusState';
import { PromisesRegistry } from '../utils/CancelablePromises';
import {GlobalActions} from "../actions/GlobalActions";

interface AuthenticationControllerReduxProps {
  addMessage: (content: string, detail: string, groupId?: string, msgType?: MessageType, showNotif?: boolean) => void;
  authenticated: boolean;
  checkCredentials: () => void;
  isLoginError: boolean;
  landingRoute?: string;
  setActiveNamespaces: (namespaces: Namespace[]) => void;
  setDuration: (duration: DurationInSeconds) => void;
  setJaegerInfo: (jaegerInfo: JaegerInfo | null) => void;
  setLandingRoute: (route: string | undefined) => void;
  setMeshTlsStatus: (meshStatus: TLSStatus) => void;
  setNamespaces: (namespaces: Namespace[], receivedAt: Date) => void;
  setRefreshInterval: (interval: IntervalInMilliseconds) => void;
  setTrafficRates: (rates: TrafficRate[]) => void;
  statusRefresh: (statusState: StatusState) => void;
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

export class AuthenticationController extends React.Component<
  AuthenticationControllerProps,
  AuthenticationControllerState
> {
  static readonly PostLoginErrorMsg = `Kiali failed to initialize. Please ensure that services
    Kiali depends on, such as Prometheus, are healthy and reachable by Kiali then refresh your browser.`;

  // How long to wait for the post-login actions to complete
  // before transitioning to the "Loading" page.
  private readonly postLoginMSTillTransition = 3000;
  private promises = new PromisesRegistry();

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

  componentWillUnmount() {
    this.promises.cancelAll();
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
    const postLoginTimer = setTimeout(() => {
      this.setState({ stage: LoginStage.LOGGED_IN_AT_LOAD });
    }, this.postLoginMSTillTransition);

    try {
      const getStatusPromise = this.promises
        .register('getStatus', API.getStatus())
        .then(response => this.processServerStatus(response.data))
        .catch(error => {
          AlertUtils.addError('Error fetching server status.', error, 'default', MessageType.WARNING);
        });
      const getJaegerInfoPromise = this.promises
        .register('getJaegerInfo', API.getJaegerInfo())
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
      const getNamespaces = this.promises.register('getNamespaces', API.getNamespaces());
      const getServerConfig = this.promises.register('getServerConfig', API.getServerConfig());

      const configs = await Promise.all([getNamespaces, getServerConfig, getStatusPromise, getJaegerInfoPromise]);

      this.props.setNamespaces(configs[0].data, new Date());
      setServerConfig(configs[1].data);
      this.applyUIDefaults();
      this.checkConfiguredRemoteKialis(configs[1].data);

      if (this.props.landingRoute) {
        history.replace(this.props.landingRoute);
        this.props.setLandingRoute(undefined);
      }
      this.setState({ stage: LoginStage.LOGGED_IN });
    } catch (err) {
      console.error('Error on post-login actions.', err);
      // Transitioning to LOGGED_IN_AT_LOAD so that the user will see the "Loading..."
      // screen instead of being stuck at the "login" page after a post-login error.
      this.setState({ isPostLoginError: true, stage: LoginStage.LOGGED_IN_AT_LOAD });
    } finally {
      clearTimeout(postLoginTimer);
    }
  };

  private applyUIDefaults() {
    const uiDefaults = serverConfig.kialiFeatureFlags.uiDefaults;
    if (uiDefaults) {
      // Duration (aka metricsPerRefresh)
      if (uiDefaults.metricsPerRefresh) {
        const validDurations = humanDurations(serverConfig, '', '');
        let metricsPerRefresh = 0;
        for (const [key, value] of Object.entries(validDurations)) {
          if (value === uiDefaults.metricsPerRefresh) {
            metricsPerRefresh = Number(key);
            break;
          }
        }
        if (metricsPerRefresh > 0) {
          this.props.setDuration(metricsPerRefresh);
          console.debug(
            `Setting UI Default: metricsPerRefresh [${uiDefaults.metricsPerRefresh}=${metricsPerRefresh}s]`
          );
        } else {
          console.debug(`Ignoring invalid UI Default: metricsPerRefresh [${uiDefaults.metricsPerRefresh}]`);
        }
      }

      // Refresh Interval
      let refreshInterval = -1;
      if (uiDefaults.refreshInterval) {
        for (const [key, value] of Object.entries(config.toolbar.refreshInterval)) {
          if (value.toLowerCase().endsWith(uiDefaults.refreshInterval.toLowerCase())) {
            refreshInterval = Number(key);
            break;
          }
        }
        if (refreshInterval >= 0) {
          this.props.setRefreshInterval(refreshInterval);
          console.debug(`Setting UI Default: refreshInterval [${uiDefaults.refreshInterval}=${refreshInterval}ms]`);
        } else {
          console.debug(`Ignoring invalid UI Default: refreshInterval [${uiDefaults.refreshInterval}]`);
        }
      }

      // Selected Namespaces
      if (uiDefaults.namespaces && uiDefaults.namespaces.length > 0) {
        // use store directly, we don't want to update on redux state change
        const namespaces = store.getState().namespaces.items;
        const namespaceNames: string[] = namespaces ? namespaces.map(ns => ns.name) : [];
        const activeNamespaces: Namespace[] = [];

        for (const name of uiDefaults.namespaces) {
          if (namespaceNames.includes(name)) {
            activeNamespaces.push({ name: name } as Namespace);
          } else {
            console.debug(`Ignoring invalid UI Default: namespace [${name}]`);
          }
        }
        if (activeNamespaces.length > 0) {
          this.props.setActiveNamespaces(activeNamespaces);
          console.debug(`Setting UI Default: namespaces ${JSON.stringify(activeNamespaces.map(ns => ns.name))}`);
        }
      }

      // Graph Traffic
      const grpcRate = toGrpcRate(uiDefaults.graph.traffic.grpc);
      const httpRate = toHttpRate(uiDefaults.graph.traffic.http);
      const tcpRate = toTcpRate(uiDefaults.graph.traffic.tcp);
      const rates: TrafficRate[] = [];
      if (grpcRate) {
        rates.push(TrafficRate.GRPC_GROUP, grpcRate);
      }
      if (httpRate) {
        rates.push(TrafficRate.HTTP_GROUP, httpRate);
      }
      if (tcpRate) {
        rates.push(TrafficRate.TCP_GROUP, tcpRate);
      }
      this.props.setTrafficRates(rates);
    }
  }

  // Check which clusters does not have an accessible Kiali instance.
  // Emit a warning telling that for those clusters, no cross-links will be available.
  private checkConfiguredRemoteKialis(backendConfigs: ServerConfig) {
    if (backendConfigs.clusters) {
      const clustersWithoutKialis = [] as string[];
      for (let cluster in backendConfigs.clusters) {
        // skip home cluster, it's always reachable
        if (cluster === backendConfigs.clusterInfo?.name) {
          continue;
        }
        if (backendConfigs.clusters.hasOwnProperty(cluster)) {
          const kialiInstance = backendConfigs.clusters[cluster].kialiInstances?.find(
            instance => instance.url.length !== 0
          );
          if (!kialiInstance) {
            clustersWithoutKialis.push(cluster);
          }
        }
      }

      if (clustersWithoutKialis.length > 0) {
        AlertUtils.addWarning(
          'Not all remote clusters have reachable Kiali instances.',
          undefined,
          undefined,
          'Context menus are disabled for remote cluster nodes if a Kiali instance is not discovered, or if the remote Kiali is not configured with an external URL.'
        );
      }
    }
  }

  private setDocLayout = () => {
    if (document.documentElement) {
      const isKiosk = isKioskMode();
      document.documentElement.className = isKiosk ? 'kiosk' : '';
      store.dispatch(GlobalActions.setKiosk(getKioskMode()));
    }
  };R

  private processServerStatus = (status: StatusState) => {
    this.props.statusRefresh(status);

    status.warningMessages.forEach(wMsg => {
      this.props.addMessage(wMsg, '', 'systemErrors', MessageType.WARNING);
    });

    if (status.status[StatusKey.DISABLED_FEATURES]) {
      this.props.addMessage("The following features are disabled: " + status.status[StatusKey.DISABLED_FEATURES], '', 'default', MessageType.INFO, false)
    }
  };
}

const mapStateToProps = (state: KialiAppState) => ({
  authenticated: state.authentication.status === LoginStatus.loggedIn,
  isLoginError: state.authentication.status === LoginStatus.error,
  landingRoute: state.authentication.landingRoute
});

const mapDispatchToProps = (dispatch: KialiDispatch) => ({
  addMessage: bindActionCreators(MessageCenterActions.addMessage, dispatch),
  checkCredentials: () => dispatch(LoginThunkActions.checkCredentials()),
  setActiveNamespaces: bindActionCreators(NamespaceActions.setActiveNamespaces, dispatch),
  setDuration: bindActionCreators(UserSettingsActions.setDuration, dispatch),
  setJaegerInfo: bindActionCreators(JaegerActions.setInfo, dispatch),
  setLandingRoute: bindActionCreators(LoginActions.setLandingRoute, dispatch),
  setMeshTlsStatus: bindActionCreators(MeshTlsActions.setinfo, dispatch),
  setNamespaces: bindActionCreators(NamespaceActions.receiveList, dispatch),
  setRefreshInterval: bindActionCreators(UserSettingsActions.setRefreshInterval, dispatch),
  setTrafficRates: bindActionCreators(GraphToolbarActions.setTrafficRates, dispatch),
  statusRefresh: bindActionCreators(HelpDropdownActions.statusRefresh, dispatch)
});

const AuthenticationControllerContainer = connect(mapStateToProps, mapDispatchToProps)(AuthenticationController);
export default AuthenticationControllerContainer;
