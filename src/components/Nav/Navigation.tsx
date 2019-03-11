import * as React from 'react';
import { VerticalNav } from 'patternfly-react';
import { navItems } from '../../routes';
import RenderPage from './RenderPage';
import { matchPath, RouteComponentProps } from 'react-router';
import _ from 'lodash';

import { MessageCenterContainer, MessageCenterTriggerContainer } from '../../containers/MessageCenterContainer';
import HelpDropdown from '../../containers/HelpDropdownContainer';
import UserDropdown from '../../containers/UserDropdownContainer';
import GlobalMTLSStatus from '../../containers/GlobalMTLSContainer';
import PfSpinnerContainer from '../../containers/PfSpinnerContainer';
import { kialiLogo } from '../../config';

export const istioConfigTitle = 'Istio Config';
export const servicesTitle = 'Services';

type PropsType = RouteComponentProps & {
  navCollapsed: boolean;
  setNavCollapsed: (collapse: boolean) => void;
  jaegerUrl: string;
  enableIntegration: boolean;
};

class Navigation extends React.Component<PropsType> {
  static contextTypes = {
    router: () => null
  };

  constructor(props: PropsType) {
    super(props);
  }

  setControlledState = event => {
    if ('navCollapsed' in event) {
      this.props.setNavCollapsed(this.props.navCollapsed);
    }
  };

  goTojaeger() {
    window.open(this.props.jaegerUrl, '_blank');
  }

  renderMenuItems() {
    const { location } = this.props;
    const activeItem = navItems.find(item => {
      let isRoute = matchPath(location.pathname, { path: item.to, exact: true, strict: false }) ? true : false;
      if (!isRoute && item.pathsActive) {
        isRoute = _.filter(item.pathsActive, path => path.test(location.pathname)).length > 0;
      }
      return isRoute;
    });
    return navItems.map(item => {
      if (item.title === 'Distributed Tracing' && !this.props.enableIntegration && this.props.jaegerUrl !== '') {
        return (
          <VerticalNav.Item
            key={item.to}
            title={item.title}
            iconClass={item.iconClass}
            active={item === activeItem}
            onClick={() => this.goTojaeger()}
          />
        );
      }
      return item.title === 'Distributed Tracing' && this.props.jaegerUrl === '' ? (
        ''
      ) : (
        <VerticalNav.Item
          key={item.to}
          title={item.title}
          iconClass={item.iconClass}
          active={item === activeItem}
          onClick={() => this.context.router.history.push(item.to)}
        />
      );
    });
  }

  render() {
    return (
      <>
        <VerticalNav
          className="kiali-vertical-nav"
          setControlledState={this.setControlledState}
          navCollapsed={this.props.navCollapsed}
        >
          <VerticalNav.Masthead title="Kiali">
            <VerticalNav.Brand iconImg={kialiLogo} />
            <PfSpinnerContainer />
            <VerticalNav.IconBar>
              <GlobalMTLSStatus />
              <MessageCenterTriggerContainer />
              <HelpDropdown />
              <UserDropdown />
            </VerticalNav.IconBar>
            <MessageCenterContainer drawerTitle="Message Center" />
          </VerticalNav.Masthead>
          {this.renderMenuItems()}
        </VerticalNav>
        <RenderPage />
      </>
    );
  }
}

export default Navigation;
