import * as React from 'react';
import { AboutModal } from 'patternfly-react';

const pfLogo = require('../../img/logo-alt.svg');

type AboutUIModalState = {
  showModal: boolean;
};

class AboutUIModal extends React.Component<Object, AboutUIModalState> {
  constructor(props: any) {
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
        productTitle="Swift Sunshine"
        logo={pfLogo}
        altLogo="Swift Sunshine Logo"
        trademarkText="Trademark Text"
      >
        <AboutModal.Versions>
          <AboutModal.VersionItem
            label={process.env.REACT_APP_NAME}
            versionText={`${process.env.REACT_APP_VERSION} (${process.env.REACT_APP_GIT_HASH})`}
          />
        </AboutModal.Versions>
      </AboutModal>
    );
  }
}

export default AboutUIModal;
