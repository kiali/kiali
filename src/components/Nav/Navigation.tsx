import * as React from 'react';
import { connect } from 'react-redux';
import { ThunkDispatch } from 'redux-thunk';
import RenderPage from './RenderPage';
import { RouteComponentProps } from 'react-router';
import Masthead from './Masthead/Masthead';
import Menu from './Menu';
import { Page, PageHeader, PageSection, Brand } from '@patternfly/react-core';
import { style } from 'typestyle';

import MessageCenterContainer from '../../components/MessageCenter/MessageCenter';
import { kialiLogo, serverConfig } from '../../config';
import { KialiAppState } from '../../store/Store';
import { KialiAppAction } from '../../actions/KialiAppAction';
import UserSettingsThunkActions from '../../actions/UserSettingsThunkActions';

type PropsType = RouteComponentProps & {
  navCollapsed: boolean;
  setNavCollapsed: (collapse: boolean) => void;
  jaegerUrl: string;
  jaegerIntegration: boolean;
};

type NavigationState = {
  isMobileView: boolean;
  isNavOpenDesktop: boolean;
  isNavOpenMobile: boolean;
};

const flexBoxColumnStyle = style({
  display: 'flex',
  flexDirection: 'column'
});

class Navigation extends React.Component<PropsType, NavigationState> {
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
    document.title = serverConfig.installationTag ? serverConfig.installationTag : 'Kiali Console';
  }

  isContentScrollable = () => {
    return !this.props.location.pathname.startsWith('/graph');
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

    const Header = (
      <PageHeader
        logo={<Brand src={kialiLogo} alt="Kiali Logo" />}
        toolbar={<Masthead />}
        showNavToggle={true}
        onNavToggle={isMobileView ? this.onNavToggleMobile : this.onNavToggleDesktop}
        isNavOpen={isMobileView ? isNavOpenMobile : isNavOpenDesktop || !this.props.navCollapsed}
      />
    );

    const Sidebar = (
      <Menu
        isNavOpen={isMobileView ? isNavOpenMobile : isNavOpenDesktop || !this.props.navCollapsed}
        jaegerIntegration={this.props.jaegerIntegration}
        location={this.props.location}
        jaegerUrl={this.props.jaegerUrl}
      />
    );

    return (
      <Page header={Header} sidebar={Sidebar} onPageResize={this.onPageResize}>
        <MessageCenterContainer drawerTitle="Message Center" />
        <PageSection className={flexBoxColumnStyle} variant={'light'}>
          <RenderPage needScroll={this.isContentScrollable()} />
        </PageSection>
      </Page>
    );
  }
}

const mapStateToProps = (state: KialiAppState) => ({
  navCollapsed: state.userSettings.interface.navCollapse,
  jaegerUrl: state.jaegerState ? state.jaegerState.jaegerURL : '',
  jaegerIntegration: state.jaegerState ? state.jaegerState.enableIntegration : false
});

const mapDispatchToProps = (dispatch: ThunkDispatch<KialiAppState, void, KialiAppAction>) => ({
  setNavCollapsed: (collapse: boolean) => dispatch(UserSettingsThunkActions.setNavCollapsed(collapse))
});

const NavigationContainer = connect(
  mapStateToProps,
  mapDispatchToProps
)(Navigation);
export default NavigationContainer;
