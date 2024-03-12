import _ from 'lodash';
import * as React from 'react';
import { matchPath } from 'react-router';
import { Link } from 'react-router-dom';
import { Nav, NavList, NavItem } from '@patternfly/react-core';
import { history } from '../../app/History';
import { navMenuItems } from '../../routes';
import { homeCluster, serverConfig } from '../../config';
import { kialiStyle } from 'styles/StyleUtils';
import { GetTracingURL } from '../TracingIntegration/TracesComponent';
import { ExternalServiceInfo } from '../../types/StatusState';
import { KialiIcon } from 'config/KialiIcon';
import { WithTranslation, withTranslation } from 'react-i18next';
import { I18N_NAMESPACE } from 'types/Common';

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

type MenuProps = WithTranslation & {
  externalServices: ExternalServiceInfo[];
  isNavOpen: boolean;
  location: any;
};

type MenuState = {
  activeItem: string;
};

class MenuComponent extends React.Component<MenuProps, MenuState> {
  static contextTypes = {
    router: () => null
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

    const tracingUrl = GetTracingURL(this.props.externalServices);

    return allNavMenuItems
      .filter(item => {
        if (item.id === 'mesh_classic') {
          return graphEnableMeshClassic && homeCluster?.name !== undefined;
        }

        if (item.id === 'mesh_graph') {
          return graphEnableMeshGraph;
        }

        if (item.id === 'overview') {
          return !graphEnableMeshOverview;
        }

        if (item.id === 'traffic_graph_cy') {
          return graphEnableCytoscape;
        }

        if (item.id === 'traffic_graph_pf') {
          return graphEnablePatternfly;
        }

        return true;
      })
      .sort((a, b): number => {
        if (graphEnableMeshOverview && a.id === 'mesh_graph') return -1;
        if (graphEnableMeshOverview && b.id === 'mesh_graph') return 1;
        return 0;
      })
      .map(item => {
        let title = item.title;

        if (item.id === 'tracing') {
          return tracingUrl && <ExternalLink key={item.to} href={tracingUrl} name={this.props.t(title)} />;
        }

        if (
          (item.id === 'traffic_graph_cy' && !graphEnablePatternfly) ||
          (item.id === 'traffic_graph_pf' && !graphEnableCytoscape)
        ) {
          title = this.props.t('Traffic Graph');
        }

        if (item.id === 'mesh_classic' || item.id === 'mesh_graph') {
          title = this.props.t('Mesh');
        }

        return (
          <NavItem isActive={activeMenuItem === item} key={item.to}>
            <Link id={item.id} to={item.to} onClick={() => history.push(item.to)}>
              {this.props.t(title)}
            </Link>
          </NavItem>
        );
      });
  };

  render(): React.ReactNode {
    return (
      <Nav aria-label="Nav" theme="dark">
        <NavList className={navListStyle}>{this.renderMenuItems()}</NavList>
      </Nav>
    );
  }
}

export const Menu = withTranslation(I18N_NAMESPACE)(MenuComponent);
