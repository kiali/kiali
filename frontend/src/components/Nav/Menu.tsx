import _ from 'lodash';
import * as React from 'react';
import { matchPath } from 'react-router';
import { Link } from 'react-router-dom';
import { Nav, NavList, NavItem } from '@patternfly/react-core';
import { history } from '../../app/History';
import { navMenuItems } from '../../routes';
import { homeCluster, serverConfig } from '../../config';
import { kialiStyle } from 'styles/StyleUtils';
import { ExternalServiceInfo } from '../../types/StatusState';
import { KialiIcon } from 'config/KialiIcon';
import { GetTracingUrlProvider } from '../../utils/tracing/UrlProviders';

const externalLinkStyle = kialiStyle({
  $nest: {
    '&:focus': {
      backgroundColor: 'transparent',
      $nest: {
        '&::before': {
          borderBottomWidth: '1px'
        }
      }
    }
  }
});

const navListStyle = kialiStyle({
  padding: 0
});

const iconStyle = kialiStyle({
  marginLeft: '0.5rem'
});

const ExternalLink = ({ href, name }: { href: string; name: string }): React.ReactElement => (
  <NavItem isActive={false} key={name}>
    <a className={externalLinkStyle} href={href} target="_blank" rel="noopener noreferrer">
      {name} <KialiIcon.ExternalLink className={iconStyle} />
    </a>
  </NavItem>
);

type MenuProps = {
  externalServices: ExternalServiceInfo[];
  isNavOpen: boolean;
  location: any;
};

type MenuState = {
  activeItem: string;
};

export class Menu extends React.Component<MenuProps, MenuState> {
  static contextTypes = {
    router: (): null => null
  };

  constructor(props: MenuProps) {
    super(props);
    this.state = {
      activeItem: 'Overview'
    };
  }

  componentDidUpdate(prevProps: Readonly<MenuProps>): void {
    if (prevProps.isNavOpen !== this.props.isNavOpen) {
      // Dispatch an extra "resize" event when side menu toggle to force that metrics charts resize
      setTimeout(() => {
        window.dispatchEvent(new Event('resize'));
      }, 200);
    }
  }

  renderMenuItems = (): React.ReactNode => {
    const { location } = this.props;
    const allNavMenuItems = navMenuItems;
    const graphEnableCytoscape = serverConfig.kialiFeatureFlags.uiDefaults.graph.impl !== 'pf';
    const graphEnablePatternfly = serverConfig.kialiFeatureFlags.uiDefaults.graph.impl !== 'cy';
    const graphEnableMeshClassic = serverConfig.kialiFeatureFlags.uiDefaults.mesh.impl === 'classic';
    const graphEnableMeshGraph = serverConfig.kialiFeatureFlags.uiDefaults.mesh.impl !== 'classic';
    const graphEnableMeshOverview = serverConfig.kialiFeatureFlags.uiDefaults.mesh.impl === 'topo-as-overview';
    const activeMenuItem = allNavMenuItems.find(item => {
      let isRoute = matchPath(location.pathname, { path: item.to, exact: true, strict: false }) ? true : false;

      if (!isRoute && item.pathsActive) {
        isRoute = _.filter(item.pathsActive, path => path.test(location.pathname)).length > 0;
      }

      return isRoute;
    });

    const tracingUrl = GetTracingUrlProvider(this.props.externalServices)?.HomeUrl();

    return allNavMenuItems
      .filter(item => {
        if (item.title === 'Mesh [classic]') {
          return graphEnableMeshClassic && homeCluster?.name !== undefined;
        }

        if (item.title === 'Mesh [graph]') {
          return graphEnableMeshGraph;
        }

        if (item.title === 'Overview') {
          return !graphEnableMeshOverview;
        }

        if (item.title === 'Traffic Graph [Cy]') {
          return graphEnableCytoscape;
        }

        if (item.title === 'Traffic Graph [PF]') {
          return graphEnablePatternfly;
        }

        return true;
      })
      .sort((a, b): number => {
        if (graphEnableMeshOverview && a.title === 'Mesh [graph]') return -1;
        if (graphEnableMeshOverview && b.title === 'Mesh [graph]') return 1;
        return 0;
      })
      .map(item => {
        if (item.title === 'Distributed Tracing') {
          return tracingUrl && <ExternalLink key={item.to} href={tracingUrl} name="Distributed Tracing" />;
        }

        let title = item.title;

        if (title === 'Traffic Graph [Cy]' && !graphEnablePatternfly) {
          title = 'Traffic Graph';
        }

        if (title === 'Traffic Graph [PF]' && !graphEnableCytoscape) {
          title = 'Traffic Graph';
        }

        if (title === 'Mesh [classic]') {
          title = 'Mesh';
        }

        if (title === 'Mesh [graph]') {
          title = 'Mesh';
        }

        return (
          <NavItem isActive={activeMenuItem === item} key={item.to}>
            <Link id={title} to={item.to} onClick={() => history.push(item.to)}>
              {title}
            </Link>
          </NavItem>
        );
      });
  };

  render(): JSX.Element {
    return (
      <Nav aria-label="Nav" theme="dark">
        <NavList className={navListStyle}>{this.renderMenuItems()}</NavList>
      </Nav>
    );
  }
}
