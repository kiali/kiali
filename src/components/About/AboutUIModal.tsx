import * as React from 'react';
import { AboutModal } from 'patternfly-react';
import { Component } from '../../store/Store';

const pfLogo = require('../../img/logo-alt.svg');
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
    return (
      <AboutModal
        show={this.state.showModal}
        onHide={this.close}
        productTitle="Kiali"
        logo={pfLogo}
        altLogo="Kiali Logo"
      >
        <AboutModal.Versions>
          <AboutModal.VersionItem
            label="kiali-ui"
            versionText={`${process.env.REACT_APP_VERSION} (${process.env.REACT_APP_GIT_HASH})`}
          />
          <AboutModal.VersionItem
            label="kiali"
            versionText={`${this.props.status[KIALI_CORE_VERSION]} (${this.props.status[KIALI_CORE_COMMIT_HASH]})`}
          />
          <h3>Components </h3>
          {this.props.components.map(component => (
            <AboutModal.VersionItem key={component.name} label={component.name} versionText={component.version} />
          ))}
        </AboutModal.Versions>
      </AboutModal>
    );
  }
}

export default AboutUIModal;
