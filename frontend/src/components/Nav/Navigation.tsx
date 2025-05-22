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
  MastheadLogo, MastheadBrand,
  MastheadContent,
  PageSection,
  PageSidebar,
  PageToggleButton,
  ButtonVariant,
  PageSidebarBody
} from '@patternfly/react-core';
import { BarsIcon } from '@patternfly/react-icons';
import { kialiStyle } from 'styles/StyleUtils';
import { MessageCenter } from '../MessageCenter/MessageCenter';
import { homeCluster, kialiLogoDark, serverConfig } from '../../config';
import { KialiAppState } from '../../store/Store';
import { UserSettingsThunkActions } from '../../actions/UserSettingsThunkActions';
import { Menu } from './Menu';
import { Link, useLocation } from 'react-router-dom-v5-compat';
import { ExternalServiceInfo } from '../../types/StatusState';

type ReduxStateProps = {
  externalServices: ExternalServiceInfo[];
  navCollapsed: boolean;
  tracingUrl?: string;
};

type ReduxDispatchProps = {
  setNavCollapsed: (collapse: boolean) => void;
};

type NavigationProps = ReduxStateProps & ReduxDispatchProps;

export const MASTHEAD_HEIGHT = '76px';

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

  const masthead = (
    <Masthead role="kiali_header" style={{ height: MASTHEAD_HEIGHT }}>
      
      <MastheadMain><MastheadToggle>
        <PageToggleButton
          variant={ButtonVariant.plain}
          aria-label="Kiali navigation"
          isSidebarOpen={isNavOpen}
          onSidebarToggle={isMobileView ? onNavToggleMobile : onNavToggleDesktop}
        >
          <BarsIcon />
        </PageToggleButton>
      </MastheadToggle>
        <MastheadBrand data-codemods><MastheadLogo data-codemods component={props => <Link {...props} to="#" />}>
          <img src={kialiLogoDark} alt="Kiali Logo" />
        </MastheadLogo></MastheadBrand>
      </MastheadMain>
      <MastheadContent style={{ height: MASTHEAD_HEIGHT }}>
        <MastheadItems />
      </MastheadContent>
    </Masthead>
  );

  const menu = <Menu isNavOpen={isNavOpen} externalServices={props.externalServices} />;

  const Sidebar = (
    <PageSidebar style={{ width: '210px' }} isSidebarOpen={isNavOpen}>
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
      <PageSection hasBodyWrapper={false} className={flexBoxColumnStyle} >
        <RenderPage isGraph={isGraph()} />
      </PageSection>
    </Page>
  );
};

const mapStateToProps = (state: KialiAppState): ReduxStateProps => ({
  navCollapsed: state.userSettings.interface.navCollapse,
  tracingUrl: state.tracingState.info && state.tracingState.info.url ? state.tracingState.info.url : undefined,
  externalServices: state.statusState.externalServices
});

const mapDispatchToProps = (dispatch: KialiDispatch): ReduxDispatchProps => ({
  setNavCollapsed: (collapse: boolean) => dispatch(UserSettingsThunkActions.setNavCollapsed(collapse))
});

export const Navigation = connect(mapStateToProps, mapDispatchToProps)(NavigationComponent);
