import * as React from 'react';
import { connect } from 'react-redux';
import { KialiDispatch } from 'types/Redux';
import { RenderPage } from './RenderPage';
import { RouteComponentProps } from 'react-router';
import { MastheadItems } from './Masthead/Masthead';
import {
  Page,
  Masthead,
  MastheadToggle,
  MastheadMain,
  MastheadBrand,
  MastheadContent,
  PageSection,
  PageSidebar,
  PageToggleButton,
  ButtonVariant,
  PageSidebarBody
} from '@patternfly/react-core';
import { BarsIcon } from '@patternfly/react-icons';
import { kialiStyle } from 'styles/StyleUtils';
import { MessageCenter } from '../../components/MessageCenter/MessageCenter';
import { homeCluster, kialiLogoDark, serverConfig } from '../../config';
import { KialiAppState } from '../../store/Store';
import { UserSettingsThunkActions } from '../../actions/UserSettingsThunkActions';
import { Menu } from './Menu';
import { Link } from 'react-router-dom';
import { ExternalServiceInfo } from '../../types/StatusState';

type ReduxStateProps = {
  externalServices: ExternalServiceInfo[];
  navCollapsed: boolean;
  tracingUrl?: string;
};

type ReduxDispatchProps = {
  setNavCollapsed: (collapse: boolean) => void;
};

type PropsType = RouteComponentProps & ReduxStateProps & ReduxDispatchProps;

type NavigationState = {
  isMobileView: boolean;
  isNavOpenDesktop: boolean;
  isNavOpenMobile: boolean;
};

const flexBoxColumnStyle = kialiStyle({
  display: 'flex',
  flexDirection: 'column'
});

export class NavigationComponent extends React.Component<PropsType, NavigationState> {
  static contextTypes = {
    router: (): null => null
  };

  constructor(props: PropsType) {
    super(props);
    this.state = {
      isMobileView: false,
      isNavOpenDesktop: true,
      isNavOpenMobile: false
    };
  }

  setControlledState = (event: Event): void => {
    if ('navCollapsed' in event) {
      this.props.setNavCollapsed(this.props.navCollapsed);
    }
  };

  goTotracing = (): void => {
    window.open(this.props.tracingUrl, '_blank');
  };

  componentDidMount = (): void => {
    let pageTitle = serverConfig.installationTag ? serverConfig.installationTag : 'Kiali';
    if (homeCluster?.name) {
      pageTitle += ` [${homeCluster?.name}]`;
    }

    document.title = pageTitle;
  };

  isGraph = (): boolean => {
    return (
      this.props.location.pathname.startsWith('/graph') ||
      this.props.location.pathname.startsWith('/graphpf') ||
      this.props.location.pathname.startsWith('/mesh')
    );
  };

  onNavToggleDesktop = (): void => {
    this.setState({
      isNavOpenDesktop: !this.state.isNavOpenDesktop
    });
    this.props.setNavCollapsed(!this.props.navCollapsed);
  };

  onNavToggleMobile = (): void => {
    this.setState({
      isNavOpenMobile: !this.state.isNavOpenMobile
    });
  };

  onPageResize = ({ mobileView, windowSize }: { mobileView: boolean; windowSize: number }): void => {
    let ismobile = mobileView;
    if (windowSize < 1000) {
      ismobile = true;
    }
    this.setState({
      isMobileView: ismobile
    });
  };

  render = (): React.ReactNode => {
    const { isNavOpenDesktop, isNavOpenMobile, isMobileView } = this.state;
    const isNavOpen = isMobileView ? isNavOpenMobile : isNavOpenDesktop || !this.props.navCollapsed;

    const masthead = (
      <Masthead role="kiali_header" style={{ height: '76px' }}>
        <MastheadToggle>
          <PageToggleButton
            variant={ButtonVariant.plain}
            aria-label="Kiali navigation"
            isSidebarOpen={isNavOpen}
            onSidebarToggle={isMobileView ? this.onNavToggleMobile : this.onNavToggleDesktop}
          >
            <BarsIcon />
          </PageToggleButton>
        </MastheadToggle>
        <MastheadMain>
          <MastheadBrand component={props => <Link {...props} to="#" />}>
            <img src={kialiLogoDark} alt="Kiali Logo" />
          </MastheadBrand>
        </MastheadMain>
        <MastheadContent style={{ height: '76px' }}>
          <MastheadItems />
        </MastheadContent>
      </Masthead>
    );

    const menu = (
      <Menu isNavOpen={isNavOpen} location={this.props.location} externalServices={this.props.externalServices} />
    );

    const Sidebar = (
      <PageSidebar style={{ width: '210px' }} isSidebarOpen={isNavOpen}>
        <PageSidebarBody>{menu}</PageSidebarBody>
      </PageSidebar>
    );

    return (
      <Page
        header={masthead}
        sidebar={Sidebar}
        onPageResize={(_, { mobileView, windowSize }) => this.onPageResize({ mobileView, windowSize })}
      >
        <MessageCenter drawerTitle="Message Center" />
        <PageSection className={flexBoxColumnStyle} variant="light">
          <RenderPage isGraph={this.isGraph()} />
        </PageSection>
      </Page>
    );
  };
}

const mapStateToProps = (state: KialiAppState): ReduxStateProps => ({
  navCollapsed: state.userSettings.interface.navCollapse,
  tracingUrl: state.tracingState.info && state.tracingState.info.url ? state.tracingState.info.url : undefined,
  externalServices: state.statusState.externalServices
});

const mapDispatchToProps = (dispatch: KialiDispatch): ReduxDispatchProps => ({
  setNavCollapsed: (collapse: boolean) => dispatch(UserSettingsThunkActions.setNavCollapsed(collapse))
});

export const Navigation = connect(mapStateToProps, mapDispatchToProps)(NavigationComponent);
