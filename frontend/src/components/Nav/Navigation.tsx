import * as React from 'react';
import { connect } from 'react-redux';
import { KialiDispatch } from 'types/Redux';
import { RenderPage } from './RenderPage';
import { MastheadItems } from './Masthead/Masthead';
import {
  Page,
  Masthead,
  MastheadToggle,
  MastheadMain,
  MastheadLogo,
  MastheadBrand,
  MastheadContent,
  PageSection,
  PageSidebar,
  PageToggleButton,
  ButtonVariant,
  PageSidebarBody
} from '@patternfly/react-core';

import { kialiStyle } from 'styles/StyleUtils';
import { MessageCenter } from '../MessageCenter/MessageCenter';
import { homeCluster, kialiLogoDark, kialiLogoLight, serverConfig } from '../../config';
import { KialiAppState } from '../../store/Store';
import { UserSettingsThunkActions } from '../../actions/UserSettingsThunkActions';
import { Menu } from './Menu';
import { Link, useLocation } from 'react-router-dom-v5-compat';
import { ExternalServiceInfo } from '../../types/StatusState';
import { Theme } from 'types/Common';

type ReduxStateProps = {
  externalServices: ExternalServiceInfo[];
  navCollapsed: boolean;
  theme: string;
  tracingUrl?: string;
};

type ReduxDispatchProps = {
  setNavCollapsed: (collapse: boolean) => void;
};

type NavigationProps = ReduxStateProps & ReduxDispatchProps;

const flexBoxColumnStyle = kialiStyle({
  display: 'flex',
  flexDirection: 'column'
});

export const NavigationComponent: React.FC<NavigationProps> = (props: NavigationProps) => {
  const [isMobileView, setIsMobileView] = React.useState<boolean>(false);
  const [isNavOpenDesktop, setIsNavOpenDesktop] = React.useState<boolean>(true);
  const [isNavOpenMobile, setIsNavOpenMobile] = React.useState<boolean>(false);

  const { pathname } = useLocation();

  React.useEffect((): void => {
    let pageTitle = serverConfig.installationTag ?? 'Kiali';

    if (homeCluster?.name) {
      pageTitle += ` [${homeCluster?.name}]`;
    }

    document.title = pageTitle;
  }, []);

  const isGraph = (): boolean => {
    return pathname.startsWith('/graph') || pathname.startsWith('/mesh');
  };

  const onNavToggleDesktop = (): void => {
    setIsNavOpenDesktop(!isNavOpenDesktop);
    props.setNavCollapsed(!props.navCollapsed);
  };

  const onNavToggleMobile = (): void => {
    setIsNavOpenMobile(!isNavOpenMobile);
  };

  const onPageResize = ({ mobileView, windowSize }: { mobileView: boolean; windowSize: number }): void => {
    let ismobile = mobileView;

    if (windowSize < 1000) {
      ismobile = true;
    }

    setIsMobileView(ismobile);
  };

  const isNavOpen = isMobileView ? isNavOpenMobile : isNavOpenDesktop || !props.navCollapsed;

  const darkTheme = props.theme === Theme.DARK;

  const masthead = (
    <Masthead role="kiali_header">
      <MastheadMain>
        <MastheadToggle>
          <PageToggleButton
            isHamburgerButton
            variant={ButtonVariant.plain}
            aria-label="Kiali navigation"
            isSidebarOpen={isNavOpen}
            onSidebarToggle={isMobileView ? onNavToggleMobile : onNavToggleDesktop}
          ></PageToggleButton>
        </MastheadToggle>
        <MastheadBrand data-codemods>
          <MastheadLogo data-codemods component={props => <Link {...props} to="#" />}>
            <img src={darkTheme ? kialiLogoDark : kialiLogoLight} alt="Kiali Logo" />
          </MastheadLogo>
        </MastheadBrand>
      </MastheadMain>
      <MastheadContent>
        <MastheadItems />
      </MastheadContent>
    </Masthead>
  );

  const menu = <Menu isNavOpen={isNavOpen} externalServices={props.externalServices} />;

  const Sidebar = (
    <PageSidebar isSidebarOpen={isNavOpen}>
      <PageSidebarBody>{menu}</PageSidebarBody>
    </PageSidebar>
  );

  return (
    <Page
      masthead={masthead}
      sidebar={Sidebar}
      onPageResize={(_, { mobileView, windowSize }) => onPageResize({ mobileView, windowSize })}
    >
      <MessageCenter drawerTitle="Message Center" />
      <PageSection hasBodyWrapper={false} className={flexBoxColumnStyle}>
        <RenderPage isGraph={isGraph()} />
      </PageSection>
    </Page>
  );
};

const mapStateToProps = (state: KialiAppState): ReduxStateProps => ({
  externalServices: state.statusState.externalServices,
  navCollapsed: state.userSettings.interface.navCollapse,
  theme: state.globalState.theme,
  tracingUrl: state.tracingState.info && state.tracingState.info.url ? state.tracingState.info.url : undefined
});

const mapDispatchToProps = (dispatch: KialiDispatch): ReduxDispatchProps => ({
  setNavCollapsed: (collapse: boolean) => dispatch(UserSettingsThunkActions.setNavCollapsed(collapse))
});

export const Navigation = connect(mapStateToProps, mapDispatchToProps)(NavigationComponent);
