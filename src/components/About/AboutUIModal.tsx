import * as React from 'react';
import { AboutModal, Spinner } from 'patternfly-react';
import * as API from '../../services/Api';
import { authentication } from '../../utils/Authentication';

const pfLogo = require('../../img/logo-alt.svg');
const KIALI_CORE_COMMIT_HASH = 'Kiali core commit hash';
const KIALI_CORE_VERSION = 'Kiali core version';

type AboutUIModalState = {
  showModal: boolean;
  loadingVersions: boolean;
  versions: Array<AboutUIModalService>;
  products: Array<AboutUIModalProduct>;
};

type AboutUIModalService = {
  name: string;
  version: string;
};

type AboutUIModalProduct = {
  name: string;
  version: string;
  full_version: string;
};

const getStatus = () => {
  return API.getStatus(authentication()).then(response => {
    const rawStatus = response['data'];
    return {
      kiali: [
        {
          name: 'kiali',
          version: `${rawStatus['status'][KIALI_CORE_VERSION]} (${rawStatus['status'][KIALI_CORE_COMMIT_HASH]})`
        }
      ],
      products: rawStatus['products']
    };
  });
};

class AboutUIModal extends React.Component<Object, AboutUIModalState> {
  constructor(props: any) {
    super(props);
    this.state = { showModal: false, loadingVersions: false, versions: [], products: [] };
  }

  open = () => {
    this.setState(state => {
      if (!state.loadingVersions) {
        getStatus().then(
          status => {
            this.setState({
              loadingVersions: false,
              versions: status['kiali'],
              products: status['products']
            });
          },
          error => {
            console.log(error);
            this.setState({
              loadingVersions: false,
              versions: [],
              products: []
            });
          }
        );
        return { showModal: true, loadingVersions: true, versions: [], products: [] };
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
            label="kiali-ui"
            versionText={`${process.env.REACT_APP_VERSION} (${process.env.REACT_APP_GIT_HASH})`}
          />
          <Spinner style={{ marginTop: '15px' }} loading={this.state.loadingVersions} size="lg" inverse={true}>
            {this.state.versions.map(service => (
              <AboutModal.VersionItem key={service.name} label={service.name} versionText={service.version} />
            ))}
            <h3>Products </h3>
            {this.state.products.map(product => (
              <AboutModal.VersionItem key={product.name} label={product.name} versionText={product.version} />
            ))}
          </Spinner>
        </AboutModal.Versions>
      </AboutModal>
    );
  }
}

export default AboutUIModal;
