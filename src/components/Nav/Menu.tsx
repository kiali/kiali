import * as React from 'react';
import { navItems } from '../../routes';
import { matchPath } from 'react-router';
import { Link } from 'react-router-dom';
import { Nav, NavList, NavItem, PageSidebar } from '@patternfly/react-core';
import _ from 'lodash';

const ExternalLink = ({ href, name }) => (
  <NavItem isActive={false} key={name}>
    <a className="pf-c-nav__link" href={href} target="_blank">
      {name}
      <span className="co-external-link" />
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
        return <ExternalLink href={this.props.jaegerUrl} name="Distributed Tracing" />;
      }

      return item.title === 'Distributed Tracing' && this.props.jaegerUrl === '' ? (
        ''
      ) : (
        <NavItem isActive={activeItem === item} key={item.to}>
          <Link id={item.title} to={item.to} onClick={() => this.context.router.history.push(item.to)}>
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
