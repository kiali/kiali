import * as React from 'react';
import { VerticalNav } from 'patternfly-react';
import PropTypes from 'prop-types';
import { navItems } from '../../routes';
import RenderPage from './RenderPage';
import { matchPath } from 'react-router';
import _ from 'lodash';

import MessageCenter from '../../containers/MessageCenterContainer';
import * as MsgCenter from '../../utils/MessageCenter';
import HelpDropdown from '../../containers/HelpDropdownContainer';
import UserDropdown from '../../containers/UserDropdownContainer';
import LoginPage from '../../containers/LoginPageContainer';
import { store } from '../../store/ConfigStore';
import PfSpinnerContainer from '../../containers/PfSpinnerContainer';
import * as API from '../../services/Api';
import { authentication } from '../../utils/Authentication';
import { KialiLogo } from '../../logos';

export const istioConfigTitle = 'Istio Config';
export const servicesTitle = 'Services';

type PropsType = {
  location: any;
  authenticated: boolean;
  navCollapsed: boolean;
  checkCredentials: () => void;
  setNavCollapsed: (collapse: boolean) => void;
};

class Navigation extends React.Component<PropsType> {
  static contextTypes = {
    router: PropTypes.object
  };

  constructor(props: any) {
    super(props);

    // handle initial path from the browser
    this.props.checkCredentials();
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
    if ('navCollapsed' in event) {
      this.props.setNavCollapsed(this.props.navCollapsed);
    }
  };

  goTojaeger() {
    API.getJaegerInfo(authentication())
      .then(response => {
        let data = response['data'];
        window.open(data.url, '_blank');
      })
      .catch(error => {
        MsgCenter.add(API.getErrorMsg('Could not fetch Jaeger info', error));
        console.log(error);
      });
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
      if (item.title === 'Distributed Tracing') {
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
      return (
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
    store.subscribe(() => {
      document.documentElement.className = this.props.authenticated ? 'layout-pf layout-pf-fixed' : 'login-pf';
    });
    return this.props.authenticated ? (
      <>
        <VerticalNav setControlledState={this.setControlledState} navCollapsed={this.props.navCollapsed}>
          <VerticalNav.Masthead title="Kiali">
            <VerticalNav.Brand iconImg={KialiLogo} />
            <PfSpinnerContainer />
            <VerticalNav.IconBar>
              <MessageCenter.Trigger />
              <HelpDropdown />
              <UserDropdown />
            </VerticalNav.IconBar>
            <MessageCenter drawerTitle="Message Center" />
          </VerticalNav.Masthead>
          {this.renderMenuItems()}
        </VerticalNav>
        <RenderPage />
      </>
    ) : (
      <LoginPage />
    );
  }
}

export default Navigation;
