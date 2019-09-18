import * as React from 'react';
import { AboutModal, TextContent, TextList, TextListItem, Title, Button } from '@patternfly/react-core';
import * as icons from '@patternfly/react-icons';
import { Component, Status, StatusKey } from '../../types/StatusState';
import { config, kialiLogo } from '../../config';

type AboutUIModalState = {
  showModal: boolean;
};

type AboutUIModalProps = {
  status: Status;
  components: Component[];
};

class AboutUIModal extends React.Component<AboutUIModalProps, AboutUIModalState> {
  constructor(props: AboutUIModalProps) {
    super(props);
    this.state = { showModal: false };
  }

  open = () => {
    this.setState({ showModal: true });
  };

  close = () => {
    this.setState({ showModal: false });
  };

  render() {
    const uiVersion =
      process.env.REACT_APP_GIT_HASH === '' || process.env.REACT_APP_GIT_HASH === 'unknown'
        ? process.env.REACT_APP_VERSION
        : `${process.env.REACT_APP_VERSION} (${process.env.REACT_APP_GIT_HASH})`;
    const coreVersion =
      this.props.status[StatusKey.KIALI_CORE_COMMIT_HASH] === '' ||
      this.props.status[StatusKey.KIALI_CORE_COMMIT_HASH] === 'unknown'
        ? this.props.status[StatusKey.KIALI_CORE_VERSION]
        : `${this.props.status[StatusKey.KIALI_CORE_VERSION]} (${this.props.status[StatusKey.KIALI_CORE_COMMIT_HASH]})`;

    return (
      <AboutModal
        isOpen={this.state.showModal}
        onClose={this.close}
        productName=""
        brandImageSrc={kialiLogo}
        brandImageAlt="Kiali Logo"
      >
        <TextContent>
          <TextList component="dl">
            <TextListItem key={'kiali-ui-name'} component="dt">
              Kiali-ui
            </TextListItem>
            <TextListItem key={'kiali-ui-version'} component="dd">
              {uiVersion!}
            </TextListItem>
            <TextListItem key={'kiali-name'} component="dt">
              Kiali
            </TextListItem>
            <TextListItem key={'kiali-version'} component="dd">
              {coreVersion!}
            </TextListItem>
          </TextList>
          <Title size="xl" style={{ padding: '20px 0px 20px' }}>
            Components
          </Title>
          <TextList component="dl">{this.props.components && this.props.components.map(this.renderComponent)}</TextList>
          {this.renderWebsiteLink()}
          {this.renderProjectLink()}
        </TextContent>
      </AboutModal>
    );
  }

  private renderComponent = (component: Component) => {
    const name = component.version ? component.name : `${component.name} URL`;
    const additionalInfo = this.additionalComponentInfoContent(component);
    return (
      <>
        <TextListItem component="dt">{name}</TextListItem>
        <TextListItem component="dd">{additionalInfo}</TextListItem>
      </>
    );
  };

  private additionalComponentInfoContent = (component: Component) => {
    if (!component.version && !component.url) {
      return 'N/A';
    }
    const version = component.version ? component.version : '';
    const url = component.url ? (
      <a href={component.url} target="_blank" rel="noopener noreferrer">
        {component.url}
      </a>
    ) : (
      ''
    );
    return (
      <>
        {version} {url}
      </>
    );
  };

  private renderWebsiteLink = () => {
    if (config.about && config.about.website) {
      const Icon = icons[config.about.website.icon];
      return (
        // @ts-ignore
        <Button component="a" href={config.about.website.url} variant="link" target="_blank">
          <Icon style={{ marginRight: '10px' }} />
          {config.about.website.linkText}
        </Button>
      );
    }

    return null;
  };

  private renderProjectLink = () => {
    if (config.about && config.about.project) {
      const Icon = icons[config.about.project.icon];
      return (
        // @ts-ignore
        <Button component="a" href={config.about.project.url} variant="link" target="_blank">
          <Icon style={{ marginRight: '10px' }} />
          {config.about.project.linkText}
        </Button>
      );
    }

    return null;
  };
}

export default AboutUIModal;
