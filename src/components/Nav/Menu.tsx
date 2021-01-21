import _ from 'lodash';
import * as React from 'react';
import { matchPath } from 'react-router';
import { Link } from 'react-router-dom';
import { Nav, NavList, NavItem, PageSidebar } from '@patternfly/react-core';
import { ExternalLinkAltIcon } from '@patternfly/react-icons';

import history from '../../app/History';
import { navItems, extensionsItems } from '../../routes';
import { serverConfig } from '../../config';

const ExternalLink = ({ href, name }) => (
  <NavItem isActive={false} key={name} className={'external_link'}>
    <a className="pf-c-nav__link" href={href} target="_blank" rel="noopener noreferrer">
      {name} <ExternalLinkAltIcon style={{ margin: '-4px 0 0 5px' }} />
    </a>
  </NavItem>
);

type MenuProps = {
  isNavOpen: boolean;
  location: any;
  jaegerUrl?: string;
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
    const allNavItems = navItems.concat(extensionsItems);
    const activeItem = allNavItems.find(item => {
      let isRoute = matchPath(location.pathname, { path: item.to, exact: true, strict: false }) ? true : false;
      if (!isRoute && item.pathsActive) {
        isRoute = _.filter(item.pathsActive, path => path.test(location.pathname)).length > 0;
      }
      return isRoute;
    });

    return allNavItems
      .filter(item => {
        // Extensions Nav Menu Items are conditionally rendered
        if (item.title === 'Iter8 Experiments') {
          return serverConfig.extensions!.iter8!.enabled;
        } else if (item.title === 'Mesh') {
          return serverConfig.clusterInfo?.name !== undefined;
        }
        return true;
      })
      .map(item => {
        if (item.title === 'Distributed Tracing') {
          return (
            this.props.jaegerUrl && (
              <ExternalLink key={item.to} href={this.props.jaegerUrl} name="Distributed Tracing" />
            )
          );
        }

        return (
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
      <Nav onSelect={() => undefined} onToggle={() => undefined} aria-label="Nav" theme={'dark'}>
        <NavList>{this.renderMenuItems()}</NavList>
      </Nav>
    );

    return <PageSidebar isNavOpen={isNavOpen} nav={PageNav} theme={'dark'} />;
  }
}

export default Menu;
