import * as React from 'react';
import { VerticalNav } from 'patternfly-react';
import PropTypes from 'prop-types';
import { Route, Redirect } from 'react-router-dom';

import SwitchErrorBoundary from '../SwitchErrorBoundary/SwitchErrorBoundary';
import PfContainerNavVertical from '../Pf/PfContainerNavVertical';

import IstioRulesPage from '../../pages/IstioRulesList/IstioRuleListPage';
import IstioRuleDetailsPage from '../../pages/IstioRuleDetails/IstioRuleDetailsPage';
import HelpDropdown from './HelpDropdown';
import ServiceDetailsPage from '../../pages/ServiceDetails/ServiceDetailsPage';
import { ServiceGraphRouteHandler } from '../../pages/ServiceGraph';
import ServiceListPage from '../../pages/ServiceList/ServiceListPage';
import ServiceJaegerPage from '../../pages/ServiceJaeger/ServiceJaegerPage';

const istioRulesPath = '/rules';
export const istioRulesTitle = 'Istio Mixer';
const serviceGraphPath = '/service-graph/istio-system';
export const serviceGraphTitle = 'Graph';
const servicesPath = '/services';
const servicesJaegerPath = '/jaeger';
export const servicesTitle = 'Services';
export const servicesJaeger = 'Distributed Tracing';

const pfLogo = require('../../img/logo-alt.svg');
const pfBrand = require('../../assets/img/kiali-title.svg');

const servicesRx = /\/namespaces\/(.*)\/services\/(.*)/g;
const istioRulesRx = /\/namespaces\/(.*)\/rules\/(.*)/g;

type PropsType = {
  location: any;
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
    } else if (pathname.startsWith('/rules')) {
      selected = istioRulesTitle;
    } else if (pathname.startsWith('/jaeger')) {
      selected = servicesJaeger;
    } else if (pathname.startsWith('/namespaces')) {
      // Use Regexp only if we have /namespaces
      if (pathname.search(servicesRx) > -1) {
        selected = servicesTitle;
      } else if (pathname.search(istioRulesRx) > -1) {
        selected = istioRulesTitle;
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

  setControlledState = event => {
    if (event.activePath) {
      // keep track of path as user clicks on nav bar
      this.setState({ selectedItem: event.activePath });
    } else if ('navCollapsed' in event) {
      this.setState({ navCollapsed: event.navCollapsed });
    }
  };

  render() {
    return (
      <>
        <VerticalNav
          setControlledState={this.setControlledState}
          activePath={this.state.selectedItem}
          navCollapsed={this.state.navCollapsed}
        >
          <VerticalNav.Masthead title="Kiali">
            <VerticalNav.Brand iconImg={pfLogo} titleImg={pfBrand} />
            <VerticalNav.IconBar>
              <HelpDropdown />
            </VerticalNav.IconBar>
          </VerticalNav.Masthead>
          <VerticalNav.Item title={serviceGraphTitle} iconClass="fa pficon-topology" onClick={this.navigateTo} />
          <VerticalNav.Item title={servicesTitle} iconClass="fa pficon-service" onClick={this.navigateTo} />
          <VerticalNav.Item title={istioRulesTitle} iconClass="fa pficon-migration" onClick={this.navigateTo} />
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
          <Route path={istioRulesPath} component={IstioRulesPage} />
          <Route path="/namespaces/:namespace/rules/:rule" component={IstioRuleDetailsPage} />
          <Redirect to={serviceGraphPath} />
        </SwitchErrorBoundary>
      </>
    );
  }

  private navigateTo = (e: any) => {
    if (e.title === servicesTitle) {
      this.context.router.history.push(servicesPath);
    } else if (e.title === istioRulesTitle) {
      this.context.router.history.push(istioRulesPath);
    } else if (e.title === servicesJaeger) {
      this.context.router.history.push(servicesJaegerPath);
    } else {
      this.context.router.history.push(serviceGraphPath);
    }
  };
}

export default Navigation;
