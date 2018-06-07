import * as React from 'react';
import { VerticalNav } from 'patternfly-react';
import PropTypes from 'prop-types';
import { Route, Redirect } from 'react-router-dom';

import SwitchErrorBoundary from '../SwitchErrorBoundary/SwitchErrorBoundary';
import PfContainerNavVertical from '../Pf/PfContainerNavVertical';
import MessageCenter from '../../containers/MessageCenterContainer';

import IstioConfigPage from '../../pages/IstioConfigList/IstioConfigListPage';
import IstioConfigDetailsPage from '../../pages/IstioConfigDetails/IstioConfigDetailsPage';
import HelpDropdown from './HelpDropdown';
import UserDropdown from '../../containers/UserDropdownContainer';
import ServiceDetailsPage from '../../pages/ServiceDetails/ServiceDetailsPage';
import ServiceGraphRouteHandler from '../../pages/ServiceGraph/ServiceGraphRouteHandler';
import ServiceListPage from '../../pages/ServiceList/ServiceListPage';
import ServiceJaegerPage from '../../pages/ServiceJaeger/ServiceJaegerPage';
import LoginPage from '../../containers/LoginPageContainer';
import { store } from '../../store/ConfigStore';
import PfSpinnerContainer from '../../containers/PfSpinnerContainer';

const istioConfigPath = '/istio';
export const istioConfigTitle = 'Istio Config';
const serviceGraphPath = '/service-graph/all';
export const serviceGraphTitle = 'Graph';
const servicesPath = '/services';
const servicesJaegerPath = '/jaeger';
export const servicesTitle = 'Services';
export const servicesJaeger = 'Distributed Tracing';

const pfLogo = require('../../img/logo-alt.svg');
const pfBrand = require('../../assets/img/kiali-title.svg');

const servicesRx = /\/namespaces\/(.*)\/services\/(.*)/g;
const istioConfigRx = /\/namespaces\/(.*)\/istio\/(.*)/g;

type PropsType = {
  location: any;
  authenticated: boolean;
};

type StateType = {
  selectedItem: string;
  navCollapsed: boolean;
};

class Navigation extends React.Component<PropsType, StateType> {
  static contextTypes = {
    router: PropTypes.object
  };

  static getDerivedStateFromProps(nextProps: PropsType, prevState: StateType): Partial<StateType> | null {
    const selected = Navigation.parsePath(nextProps.location.pathname);
    if (selected === prevState.selectedItem) {
      return null;
    }

    return {
      selectedItem: `/${selected}/`
    };
  }

  private static parsePath = (pathname: string) => {
    let selected = '';
    if (pathname.startsWith('/services')) {
      selected = servicesTitle;
    } else if (pathname.startsWith('/service-graph')) {
      selected = serviceGraphTitle;
    } else if (pathname.startsWith('/istio')) {
      selected = istioConfigTitle;
    } else if (pathname.startsWith('/jaeger')) {
      selected = servicesJaeger;
    } else if (pathname.startsWith('/namespaces')) {
      // Use Regexp only if we have /namespaces
      if (pathname.search(servicesRx) > -1) {
        selected = servicesTitle;
      } else if (pathname.search(istioConfigRx) > -1) {
        selected = istioConfigTitle;
      }
    } else {
      selected = serviceGraphTitle;
    }
    return selected;
  };

  constructor(props: any) {
    super(props);

    // handle initial path from the browser
    const selected = Navigation.parsePath(props.location.pathname);
    this.state = {
      selectedItem: `/${selected}/`,
      navCollapsed: false
    };
  }

  componentDidMount() {
    // Change layout-pf layout-pf-fixed by
    if (this.props.authenticated) {
      document.documentElement.className = 'layout-pf layout-pf-fixed';
    } else {
      document.documentElement.className = 'login-pf';
    }
  }

  setControlledState = event => {
    if (event.activePath) {
      // keep track of path as user clicks on nav bar
      this.setState({ selectedItem: event.activePath });
    } else if ('navCollapsed' in event) {
      this.setState({ navCollapsed: event.navCollapsed });
    }
  };

  render() {
    store.subscribe(() => {
      document.documentElement.className = this.props.authenticated ? 'layout-pf layout-pf-fixed' : 'login-pf';
    });
    return this.props.authenticated ? (
      <>
        <VerticalNav
          setControlledState={this.setControlledState}
          activePath={this.state.selectedItem}
          navCollapsed={this.state.navCollapsed}
        >
          <VerticalNav.Masthead title="Kiali">
            <VerticalNav.Brand iconImg={pfLogo} titleImg={pfBrand} />
            <PfSpinnerContainer />
            <VerticalNav.IconBar>
              <MessageCenter.Trigger />
              <HelpDropdown />
              <UserDropdown />
            </VerticalNav.IconBar>
            <MessageCenter drawerTitle="Message Center" />
          </VerticalNav.Masthead>
          <VerticalNav.Item title={serviceGraphTitle} iconClass="fa pficon-topology" onClick={this.navigateTo} />
          <VerticalNav.Item title={servicesTitle} iconClass="fa pficon-service" onClick={this.navigateTo} />
          <VerticalNav.Item title={istioConfigTitle} iconClass="fa pficon-template" onClick={this.navigateTo} />
          <VerticalNav.Item title={servicesJaeger} iconClass="fa fa-paw" onClick={this.navigateTo} />
        </VerticalNav>
        <SwitchErrorBoundary
          fallBackComponent={() => (
            <PfContainerNavVertical>
              <h2>Sorry, there was a problem. Try a refresh or navigate to a different page.</h2>
            </PfContainerNavVertical>
          )}
        >
          <Route path="/service-graph/:namespace" component={ServiceGraphRouteHandler} />
          <Route path={servicesPath} component={ServiceListPage} />
          <Route path={servicesJaegerPath} component={ServiceJaegerPage} />
          <Route path="/namespaces/:namespace/services/:service" component={ServiceDetailsPage} />
          <Route path={istioConfigPath} component={IstioConfigPage} />
          <Route path="/namespaces/:namespace/istio/:objectType/:object" component={IstioConfigDetailsPage} />
          <Redirect to={serviceGraphPath} />
        </SwitchErrorBoundary>
      </>
    ) : (
      <LoginPage />
    );
  }

  private navigateTo = (e: any) => {
    if (e.title === servicesTitle) {
      this.context.router.history.push(servicesPath);
    } else if (e.title === istioConfigTitle) {
      this.context.router.history.push(istioConfigPath);
    } else if (e.title === servicesJaeger) {
      this.context.router.history.push(servicesJaegerPath);
    } else {
      this.context.router.history.push(serviceGraphPath);
    }
  };
}

export default Navigation;
