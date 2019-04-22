import * as React from 'react';
import { AboutModal, TextContent, TextList, TextListItem, Title, Button } from '@patternfly/react-core';
import * as icons from '@patternfly/react-icons';
import { Component } from '../../store/Store';
import { config, kialiLogo } from '../../config';

const KIALI_CORE_COMMIT_HASH = 'Kiali core commit hash';
const KIALI_CORE_VERSION = 'Kiali core version';

type AboutUIModalState = {
  showModal: boolean;
};

type AboutUIModalProps = {
  status: { [key: string]: string };
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
      this.props.status[KIALI_CORE_COMMIT_HASH] === '' || this.props.status[KIALI_CORE_COMMIT_HASH] === 'unknown'
        ? this.props.status[KIALI_CORE_VERSION]
        : `${this.props.status[KIALI_CORE_VERSION]} (${this.props.status[KIALI_CORE_COMMIT_HASH]})`;

    return (
      <AboutModal
        isOpen={this.state.showModal}
        onClose={this.close}
        productName=""
        brandImageSrc={kialiLogo}
        brandImageAlt="Kiali Logo"
        logoImageSrc={kialiLogo}
        logoImageAlt="Kiali Logo"
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
          <TextList component="dl">
            {this.props.components &&
              this.props.components.map(component => (
                <React.Fragment key={`${component.name}_${component.version}`}>
                  <TextListItem key={component.name} component="dt">
                    {component.version ? component.name : `${component.name}URL`}
                  </TextListItem>
                  <TextListItem key={component.version} component="dd">{`${
                    component.version ? component.version : ''
                  } ${component.version ? (component.url ? `(${component.url})` : '') : component.url}`}</TextListItem>
                </React.Fragment>
              ))}
          </TextList>
          {this.renderWebsiteLink()}
          {this.renderProjectLink()}
        </TextContent>
      </AboutModal>
    );
  }

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
