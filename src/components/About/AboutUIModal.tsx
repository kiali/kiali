import * as React from 'react';
import { AboutModal, Icon } from 'patternfly-react';
import { Component } from '../../store/Store';
import { config, KialiLogo } from '../../config';

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
      <AboutModal show={this.state.showModal} onHide={this.close} productTitle={<img src={KialiLogo} />}>
        <AboutModal.Versions>
          <AboutModal.VersionItem label="kiali-ui" versionText={uiVersion!} />
          <AboutModal.VersionItem label="kiali" versionText={coreVersion!} />
          <h3>Components </h3>
          {this.props.components &&
            this.props.components.map(component => (
              <AboutModal.VersionItem
                key={component.name}
                label={component.version ? component.name : `${component.name}URL`}
                versionText={`${component.version ? component.version : ''} ${
                  component.version ? (component.url ? `(${component.url})` : '') : component.url
                }`}
              />
            ))}
        </AboutModal.Versions>
        {this.renderWebsiteLink()}
        {this.renderProjectLink()}
      </AboutModal>
    );
  }

  private renderWebsiteLink = () => {
    if (config().about && config().about.website) {
      return (
        <div>
          <a href={config().about.website.url} target="_blank">
            <Icon
              name={config().about.website.iconName}
              type={config().about.website.iconType}
              size="lg"
              style={{ color: 'white' }}
            />{' '}
            {config().about.website.linkText}
          </a>
        </div>
      );
    }

    return null;
  };

  private renderProjectLink = () => {
    if (config().about && config().about.project) {
      return (
        <div>
          <a href={config().about.project.url} target="_blank">
            <Icon
              name={config().about.project.iconName}
              type={config().about.project.iconType}
              size="lg"
              style={{ color: 'white' }}
            />{' '}
            {config().about.project.linkText}
          </a>
        </div>
      );
    }

    return null;
  };
}

export default AboutUIModal;
