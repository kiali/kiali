import * as React from 'react';
import RenderPage from './RenderPage';
import { RouteComponentProps } from 'react-router';
import Masthead from './Masthead/Masthead';
import Menu from './Menu';
import { Page, PageHeader, PageSection, Brand } from '@patternfly/react-core';

import { MessageCenterContainer } from '../../containers/MessageCenterContainer';
import { kialiLogo, serverConfig } from '../../config';

export const istioConfigTitle = 'Istio Config';
export const servicesTitle = 'Services';

type PropsType = RouteComponentProps & {
  navCollapsed: boolean;
  setNavCollapsed: (collapse: boolean) => void;
  jaegerUrl: string;
  jaegerIntegration: boolean;
};

class Navigation extends React.Component<PropsType> {
  static contextTypes = {
    router: () => null
  };

  constructor(props: PropsType) {
    super(props);
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

  onNavToggle = () => {
    this.props.setNavCollapsed(!this.props.navCollapsed);
  };

  isContentScrollable = () => {
    const urlParams = new URLSearchParams(this.props.location.search);
    let isMetricTab = false;
    if (urlParams.has('tab')) {
      isMetricTab = urlParams.get('tab') === 'metrics';
    }
    return !this.props.location.pathname.startsWith('/graph') && !isMetricTab;
  };

  render() {
    const Header = (
      <PageHeader
        logo={<Brand src={kialiLogo} alt="Patternfly Logo" />}
        toolbar={<Masthead />}
        showNavToggle={true}
        onNavToggle={this.onNavToggle}
      />
    );

    const Sidebar = (
      <Menu
        isNavOpen={!this.props.navCollapsed}
        jaegerIntegration={this.props.jaegerIntegration}
        location={this.props.location}
        jaegerUrl={this.props.jaegerUrl}
      />
    );

    return (
      <Page header={Header} sidebar={Sidebar}>
        <MessageCenterContainer drawerTitle="Message Center" />
        <PageSection variant={'light'}>
          <RenderPage needScroll={this.isContentScrollable()} />
        </PageSection>
      </Page>
    );
  }
}

export default Navigation;
