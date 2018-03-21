import * as React from 'react';
import { AboutModal, Spinner } from 'patternfly-react';
import * as API from '../../services/Api';

const pfLogo = require('../../img/logo-alt.svg');
const SWS_CORE_COMMIT_HASH = 'SWS core commit hash';
const SWS_CORE_VERSION = 'SWS core version';

type AboutUIModalState = {
  showModal: boolean;
  loadingVersions: boolean;
  versions: Array<AboutUIModalService>;
};

type AboutUIModalService = {
  name: string;
  version: string;
};

const getStatus = () => {
  return API.GetStatus().then(response => {
    const rawStatus = response['data'];
    return [
      {
        name: 'swscore',
        version: `${rawStatus[SWS_CORE_VERSION]} (${rawStatus[SWS_CORE_COMMIT_HASH]})`
      }
    ];
  });
};

class AboutUIModal extends React.Component<Object, AboutUIModalState> {
  constructor(props: any) {
    super(props);
    this.state = { showModal: false, loadingVersions: false, versions: [] };
  }

  open = () => {
    this.setState(state => {
      if (!state.loadingVersions) {
        getStatus().then(
          status => {
            this.setState({
              loadingVersions: false,
              versions: status
            });
          },
          error => {
            console.log(error);
            this.setState({
              loadingVersions: false,
              versions: []
            });
          }
        );
        return { showModal: true, loadingVersions: true, versions: [] };
      }
      return state;
    });
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
        trademarkText="Trademark Text"
      >
        <AboutModal.Versions>
          <AboutModal.VersionItem
            label={process.env.REACT_APP_NAME}
            versionText={`${process.env.REACT_APP_VERSION} (${process.env.REACT_APP_GIT_HASH})`}
          />
          <Spinner style={{ marginTop: '15px' }} loading={this.state.loadingVersions} size="lg" inverse={true}>
            {this.state.versions.map(service => (
              <AboutModal.VersionItem key={service.name} label={service.name} versionText={service.version} />
            ))}
          </Spinner>
        </AboutModal.Versions>
      </AboutModal>
    );
  }
}

export default AboutUIModal;
