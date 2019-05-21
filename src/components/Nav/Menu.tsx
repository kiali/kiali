import _ from 'lodash';
import * as React from 'react';
import { matchPath } from 'react-router';
import { Link } from 'react-router-dom';
import { Nav, NavList, NavItem, PageSidebar } from '@patternfly/react-core';
import { ExternalLinkAltIcon } from '@patternfly/react-icons';

import history from '../../app/History';
import { navItems } from '../../routes';

const ExternalLink = ({ href, name }) => (
  <NavItem isActive={false} key={name}>
    <a className="pf-c-nav__link" href={href} target="_blank">
      {name} <ExternalLinkAltIcon style={{ margin: '-4px 0 0 5px' }} />
    </a>
  </NavItem>
);

type MenuProps = {
  isNavOpen: boolean;
  location: any;
  jaegerUrl: string;
  jaegerIntegration: boolean;
};

type MenuState = {
  activeItem: string;
};

class Menu extends React.Component<MenuProps, MenuState> {
  static contextTypes = {
    router: () => null
  };

  constructor(props: MenuProps) {
    super(props);
    this.state = {
      activeItem: 'Overview'
    };
  }

  renderMenuItems = () => {
    const { location } = this.props;
    const activeItem = navItems.find(item => {
      let isRoute = matchPath(location.pathname, { path: item.to, exact: true, strict: false }) ? true : false;
      if (!isRoute && item.pathsActive) {
        isRoute = _.filter(item.pathsActive, path => path.test(location.pathname)).length > 0;
      }
      return isRoute;
    });
    return navItems.map(item => {
      if (item.title === 'Distributed Tracing' && !this.props.jaegerIntegration && this.props.jaegerUrl !== '') {
        return <ExternalLink key={item.to} href={this.props.jaegerUrl} name="Distributed Tracing" />;
      }

      return item.title === 'Distributed Tracing' && this.props.jaegerUrl === '' ? (
        ''
      ) : (
        <NavItem isActive={activeItem === item} key={item.to}>
          <Link id={item.title} to={item.to} onClick={() => history.push(item.to)}>
            {item.title}
          </Link>
        </NavItem>
      );
    });
  };

  render() {
    const { isNavOpen } = this.props;

    const PageNav = (
      <Nav onSelect={() => undefined} onToggle={() => undefined} aria-label="Nav">
        <NavList>{this.renderMenuItems()}</NavList>
      </Nav>
    );

    return <PageSidebar isNavOpen={isNavOpen} nav={PageNav} />;
  }
}

export default Menu;
