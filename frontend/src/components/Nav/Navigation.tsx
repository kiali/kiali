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
  ButtonVariant
} from '@patternfly/react-core';
import { BarsIcon } from '@patternfly/react-icons';
import { kialiStyle } from 'styles/StyleUtils';
import { MessageCenter } from '../../components/MessageCenter/MessageCenter';
import { homeCluster, kialiLogoDark, serverConfig } from '../../config';
import { KialiAppState } from '../../store/Store';
import { UserSettingsThunkActions } from '../../actions/UserSettingsThunkActions';
import { Menu } from './Menu';
import { Link } from 'react-router-dom';

type PropsType = RouteComponentProps & {
  navCollapsed: boolean;
  setNavCollapsed: (collapse: boolean) => void;
  jaegerUrl?: string;
};

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
    router: () => null
  };

  constructor(props: PropsType) {
    super(props);
    this.state = {
      isMobileView: false,
      isNavOpenDesktop: true,
      isNavOpenMobile: false
    };
  }

  setControlledState = event => {
    if ('navCollapsed' in event) {
      this.props.setNavCollapsed(this.props.navCollapsed);
    }
  };

  goTojaeger() {
    window.open(this.props.jaegerUrl, '_blank');
  }

  componentDidMount() {
    let pageTitle = serverConfig.installationTag ? serverConfig.installationTag : 'Kiali';
    if (homeCluster?.name) {
      pageTitle += ` [${homeCluster?.name}]`;
    }

    document.title = pageTitle;
  }

  isGraph = () => {
    return this.props.location.pathname.startsWith('/graph') || this.props.location.pathname.startsWith('/graphpf');
  };

  onNavToggleDesktop = () => {
    this.setState({
      isNavOpenDesktop: !this.state.isNavOpenDesktop
    });
    this.props.setNavCollapsed(!this.props.navCollapsed);
  };

  onNavToggleMobile = () => {
    this.setState({
      isNavOpenMobile: !this.state.isNavOpenMobile
    });
  };

  onPageResize = ({ mobileView, windowSize }) => {
    let ismobile = mobileView;
    if (windowSize < 1000) {
      ismobile = true;
    }
    this.setState({
      isMobileView: ismobile
    });
  };

  render() {
    const { isNavOpenDesktop, isNavOpenMobile, isMobileView } = this.state;
    const isNavOpen = isMobileView ? isNavOpenMobile : isNavOpenDesktop || !this.props.navCollapsed;

    const masthead = (
      <Masthead role="kiali_header" style={{ height: '76px' }}>
        <MastheadToggle>
          <PageToggleButton
            variant={ButtonVariant.plain}
            aria-label="Kiali navigation"
            isNavOpen={isNavOpen}
            onNavToggle={isMobileView ? this.onNavToggleMobile : this.onNavToggleDesktop}
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

    const menu = <Menu isNavOpen={isNavOpen} location={this.props.location} jaegerUrl={this.props.jaegerUrl} />;

    const Sidebar = <PageSidebar style={{ width: '210px' }} nav={menu} isNavOpen={isNavOpen} />;

    return (
      <Page header={masthead} sidebar={Sidebar} onPageResize={this.onPageResize}>
        <MessageCenter drawerTitle="Message Center" />
        <PageSection className={flexBoxColumnStyle} variant="light">
          <RenderPage isGraph={this.isGraph()} />
        </PageSection>
      </Page>
    );
  }
}

const mapStateToProps = (state: KialiAppState) => ({
  navCollapsed: state.userSettings.interface.navCollapse,
  jaegerUrl: state.jaegerState.info && state.jaegerState.info.url ? state.jaegerState.info.url : undefined
});

const mapDispatchToProps = (dispatch: KialiDispatch) => ({
  setNavCollapsed: (collapse: boolean) => dispatch(UserSettingsThunkActions.setNavCollapsed(collapse))
});

export const Navigation = connect(mapStateToProps, mapDispatchToProps)(NavigationComponent);
