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

    const tracingUrl = GetTracingUrlProvider(props.externalServices)?.HomeUrl();

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
          return tracingUrl && <ExternalLink key={item.to} href={tracingUrl} name={t(title)} />;
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
