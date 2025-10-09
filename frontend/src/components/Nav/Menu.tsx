import _ from 'lodash';
import * as React from 'react';
import { Link, useLocation, useNavigate, matchPath } from 'react-router-dom-v5-compat';
import { Nav, NavList, NavItem } from '@patternfly/react-core';
import { navMenuItems } from '../../routes';
import { kialiStyle } from 'styles/StyleUtils';
import { ExternalServiceInfo } from '../../types/StatusState';
import { KialiIcon } from 'config/KialiIcon';
import { GetTracingUrlProvider } from '../../utils/tracing/UrlProviders';
import { t } from 'utils/I18nUtils';
import { isControlPlaneAccessible } from '../../utils/MeshUtils';
import { isTempoService } from '../../utils/tracing/UrlProviders/Tempo';
import { TempoUrlFormat } from '../../types/StatusState';

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
};

export const Menu: React.FC<MenuProps> = (props: MenuProps) => {
  const navigate = useNavigate();
  const { pathname } = useLocation();

  const { isNavOpen } = props;

  React.useEffect(() => {
    // Dispatch an extra "resize" event when side menu toggle to force that metrics charts resize
    setTimeout(() => {
      window.dispatchEvent(new Event('resize'));
    }, 200);
  }, [isNavOpen]);

  const renderMenuItems = (): React.ReactNode => {
    const allNavMenuItems = navMenuItems;

    const activeMenuItem = allNavMenuItems.find(item => {
      let isRoute = matchPath({ path: item.to }, pathname) ? true : false;

      if (!isRoute && item.pathsActive) {
        isRoute = _.filter(item.pathsActive, path => path.test(pathname)).length > 0;
      }

      return isRoute;
    });

    const tracingUrlProvider = GetTracingUrlProvider(props.externalServices);
    const baseTracingUrl = tracingUrlProvider?.HomeUrl();

    // Helper function to build tracing URL with appropriate parameters
    const buildTracingUrlWithParams = (baseUrl: string): string => {
      const urlParams = new URLSearchParams();

      // Find the tracing service to check its configuration
      const tracingService = props.externalServices.find(service =>
        ['tempo', 'jaeger'].includes(service.name.toLowerCase())
      );

      // Check if it's a Tempo service with OpenShift format
      if (
        tracingService &&
        isTempoService(tracingService) &&
        tracingService.tempoConfig?.urlFormat === TempoUrlFormat.OPENSHIFT
      ) {
        // Add OpenShift-specific parameters
        if (tracingService.tempoConfig?.namespace) {
          urlParams.append('namespace', tracingService.tempoConfig?.namespace);
        }
        if (tracingService.tempoConfig?.name) {
          urlParams.append('name', tracingService.tempoConfig?.name);
        }
        if (tracingService.tempoConfig?.tenant) {
          urlParams.append('tenant', tracingService.tempoConfig?.tenant);
        }
        return `${baseUrl}?${urlParams.toString()}`;
      }

      return baseUrl;
    };

    return allNavMenuItems
      .filter(item => {
        if (item.id === 'mesh') {
          return isControlPlaneAccessible();
        }

        return true;
      })
      .map(item => {
        let title = item.title;

        if (item.id === 'tracing') {
          if (baseTracingUrl) {
            const tracingUrlWithParams = buildTracingUrlWithParams(baseTracingUrl);
            return <ExternalLink key={item.to} href={tracingUrlWithParams} name={t(title)} />;
          }
          return null;
        }

        return (
          <NavItem isActive={activeMenuItem === item} key={item.to}>
            <Link id={item.id} to={item.to} onClick={() => navigate(item.to)}>
              {t(title)}
            </Link>
          </NavItem>
        );
      });
  };

  return (
    <Nav aria-label="Nav" theme="dark">
      <NavList className={navListStyle}>{renderMenuItems()}</NavList>
    </Nav>
  );
};
