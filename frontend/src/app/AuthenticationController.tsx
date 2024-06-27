import * as React from 'react';
import { connect } from 'react-redux';
import { bindActionCreators } from 'redux';
import { authenticationConfig, isAuthStrategyOAuth } from '../config/AuthenticationConfig';
import { KialiAppState, LoginStatus } from '../store/Store';
import * as API from '../services/Api';
import { HelpDropdownActions } from '../actions/HelpDropdownActions';
import { TracingActions } from '../actions/TracingActions';
import { LoginThunkActions } from '../actions/LoginThunkActions';
import { MessageCenterActions } from '../actions/MessageCenterActions';
import { MessageType } from '../types/MessageCenter';
import { KialiDispatch } from '../types/Redux';
import { InitializingScreen } from './InitializingScreen';
import { getKioskMode, isKioskMode } from '../utils/SearchParamUtils';
import * as AlertUtils from '../utils/AlertUtils';
import { setServerConfig, serverConfig, humanDurations } from '../config/ServerConfig';
import { AuthStrategy } from '../types/Auth';
import { TracingInfo } from '../types/TracingInfo';
import { LoginActions } from '../actions/LoginActions';
import { NamespaceActions } from 'actions/NamespaceAction';
import { Namespace } from 'types/Namespace';
import { UserSettingsActions } from 'actions/UserSettingsActions';
import { DurationInSeconds, IntervalInMilliseconds, PF_THEME_DARK, Theme } from 'types/Common';
import { config } from 'config';
import { store } from 'store/ConfigStore';
import { toGrpcRate, toHttpRate, toTcpRate, TrafficRate } from 'types/Graph';
import { GraphToolbarActions } from 'actions/GraphToolbarActions';
import { StatusState, StatusKey } from 'types/StatusState';
import { PromisesRegistry } from '../utils/CancelablePromises';
import { GlobalActions } from '../actions/GlobalActions';
import { getKialiTheme } from 'utils/ThemeUtils';
import { i18n } from 'i18n';
import { t } from 'utils/I18nUtils';
import { router } from './History';
import { useLocation } from 'react-router-dom-v5-compat';

interface ReduxStateProps {
  authenticated: boolean;
  isLoginError: boolean;
  landingRoute?: string;
}

interface ReduxDispatchProps {
  addMessage: (content: string, detail: string, groupId?: string, msgType?: MessageType, showNotif?: boolean) => void;
  checkCredentials: () => void;
  setActiveNamespaces: (namespaces: Namespace[]) => void;
  setDuration: (duration: DurationInSeconds) => void;
  setLandingRoute: (route: string | undefined) => void;
  setNamespaces: (namespaces: Namespace[], receivedAt: Date) => void;
  setRefreshInterval: (interval: IntervalInMilliseconds) => void;
  setTracingInfo: (tracingInfo: TracingInfo | null) => void;
  setTrafficRates: (rates: TrafficRate[]) => void;
  statusRefresh: (statusState: StatusState) => void;
}

type AuthenticationControllerReduxProps = ReduxStateProps & ReduxDispatchProps;

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

const postLoginErrorMsg = t(`Kiali failed to initialize. Please ensure that services
    Kiali depends on, such as Prometheus, are healthy and reachable by Kiali then refresh your browser.`);

const AuthenticationControllerComponent: React.FC<AuthenticationControllerProps> = (
  props: AuthenticationControllerProps
) => {
  const [isPostLoginError, setIsPostLoginError] = React.useState<boolean>(false);
  const [stage, setStage] = React.useState<LoginStage>(
    props.authenticated ? LoginStage.LOGGED_IN_AT_LOAD : LoginStage.LOGIN
  );

  const { pathname, search } = useLocation();

  // How long to wait for the post-login actions to complete
  // before transitioning to the "Loading" page.
  const postLoginMSTillTransition = 3000;
  const promises = new PromisesRegistry();

  React.useEffect(() => {
    if (stage === LoginStage.LOGGED_IN_AT_LOAD) {
      doPostLoginActions();
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

      if (dispatchLoginCycleOnLoad) {
        props.checkCredentials();

        // This state shows the initializing screen while doing the login cycle. This
        // prevents from briefly showing the login form while the trip to the back-end completes.
        setStage(LoginStage.LOGGED_IN_AT_LOAD);
      } else {
        props.setLandingRoute(pathname + search);
      }
    }

    setDocLayout();

    // returned function will be called on component unmount
    return () => {
      promises.cancelAll();
    };
  }, []);

  const { authenticated, isLoginError } = props;

  React.useEffect(() => {
    if (authenticated) {
      setStage(LoginStage.POST_LOGIN);
      doPostLoginActions();
    } else {
      setStage(LoginStage.LOGIN);
    }

    setDocLayout();
  }, [authenticated]);

  React.useEffect(() => {
    if (isLoginError) {
      setStage(LoginStage.LOGIN);
    }

    setDocLayout();
  }, [isLoginError]);

  const doPostLoginActions = async (): Promise<void> => {
    const postLoginTimer = setTimeout(() => {
      setStage(LoginStage.LOGGED_IN_AT_LOAD);
    }, postLoginMSTillTransition);

    try {
      const getNamespaces = promises.register('getNamespaces', API.getNamespaces());
      const getServerConfig = promises.register('getServerConfig', API.getServerConfig());

      const getStatusPromise = promises
        .register('getStatus', API.getStatus())
        .then(response => processServerStatus(response.data))
        .catch(error => {
          AlertUtils.addError('Error fetching server status.', error, 'default', MessageType.WARNING);
        });

      const getTracingInfoPromise = promises
        .register('getTracingInfo', API.getTracingInfo())
        .then(response => props.setTracingInfo(response.data))
        .catch(error => {
          props.setTracingInfo(null);
          AlertUtils.addError(
            'Could not fetch Tracing info. Turning off Tracing integration.',
            error,
            'default',
            MessageType.INFO
          );
        });

      const configs = await Promise.all([getNamespaces, getServerConfig, getStatusPromise, getTracingInfoPromise]);

      props.setNamespaces(configs[0].data, new Date());
      setServerConfig(configs[1].data);
      applyUIDefaults();

      if (props.landingRoute) {
        router.navigate(props.landingRoute, { replace: true });
        props.setLandingRoute(undefined);
      }

      setStage(LoginStage.LOGGED_IN);
    } catch (err) {
      console.error('Error on post-login actions.', err);

      // Transitioning to LOGGED_IN_AT_LOAD so that the user will see the "Loading..."
      // screen instead of being stuck at the "login" page after a post-login error.
      setIsPostLoginError(true);
      setStage(LoginStage.LOGGED_IN_AT_LOAD);
    } finally {
      clearTimeout(postLoginTimer);
    }
  };

  const applyUIDefaults = (): void => {
    const uiDefaults = serverConfig.kialiFeatureFlags.uiDefaults;

    if (uiDefaults) {
      // Set I18n language
      let language = store.getState().globalState.language || uiDefaults.i18n.language;

      // Set language to default English value to force React re-render on language change
      store.dispatch(GlobalActions.setLanguage('en'));

      i18n.changeLanguage(language).then(() => {
        store.dispatch(GlobalActions.setLanguage(language));
      });

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
          props.setDuration(metricsPerRefresh);
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
          props.setRefreshInterval(refreshInterval);
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
          props.setActiveNamespaces(activeNamespaces);
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

      props.setTrafficRates(rates);
    }
  };

  const setDocLayout = (): void => {
    // Set theme
    const theme = getKialiTheme();
    if (theme === Theme.DARK) {
      document.documentElement.classList.add(PF_THEME_DARK);
    }
    store.dispatch(GlobalActions.setTheme(theme));

    // Set Kiosk mode
    const isKiosk = isKioskMode();
    if (isKiosk) {
      document.body.classList.add('kiosk');
    }
    store.dispatch(GlobalActions.setKiosk(getKioskMode()));
  };

  const processServerStatus = (status: StatusState): void => {
    props.statusRefresh(status);

    if (status.status[StatusKey.DISABLED_FEATURES]) {
      props.addMessage(
        `The following features are disabled: ${status.status[StatusKey.DISABLED_FEATURES]}`,
        '',
        'default',
        MessageType.INFO,
        false
      );
    }
  };

  let renderComponent: React.ReactNode;

  if (stage === LoginStage.LOGGED_IN) {
    renderComponent = props.protectedAreaComponent;
  } else if (stage === LoginStage.LOGGED_IN_AT_LOAD) {
    renderComponent = !isPostLoginError ? <InitializingScreen /> : <InitializingScreen errorMsg={postLoginErrorMsg} />;
  } else if (stage === LoginStage.POST_LOGIN) {
    // For OAuth/OpenID auth strategies, show/keep the initializing screen unless there
    // is an error.
    if (!isPostLoginError && isAuthStrategyOAuth()) {
      renderComponent = <InitializingScreen />;
    }

    renderComponent = !isPostLoginError
      ? props.publicAreaComponent(true)
      : props.publicAreaComponent(false, postLoginErrorMsg);
  } else {
    renderComponent = props.publicAreaComponent(false);
  }

  return <>{renderComponent}</>;
};

const mapStateToProps = (state: KialiAppState): ReduxStateProps => ({
  authenticated: state.authentication.status === LoginStatus.loggedIn,
  isLoginError: state.authentication.status === LoginStatus.error,
  landingRoute: state.authentication.landingRoute
});

const mapDispatchToProps = (dispatch: KialiDispatch): ReduxDispatchProps => ({
  addMessage: bindActionCreators(MessageCenterActions.addMessage, dispatch),
  checkCredentials: () => dispatch(LoginThunkActions.checkCredentials()),
  setActiveNamespaces: bindActionCreators(NamespaceActions.setActiveNamespaces, dispatch),
  setDuration: bindActionCreators(UserSettingsActions.setDuration, dispatch),
  setLandingRoute: bindActionCreators(LoginActions.setLandingRoute, dispatch),
  setNamespaces: bindActionCreators(NamespaceActions.receiveList, dispatch),
  setRefreshInterval: bindActionCreators(UserSettingsActions.setRefreshInterval, dispatch),
  setTracingInfo: bindActionCreators(TracingActions.setInfo, dispatch),
  setTrafficRates: bindActionCreators(GraphToolbarActions.setTrafficRates, dispatch),
  statusRefresh: bindActionCreators(HelpDropdownActions.statusRefresh, dispatch)
});

export const AuthenticationController = connect(mapStateToProps, mapDispatchToProps)(AuthenticationControllerComponent);
