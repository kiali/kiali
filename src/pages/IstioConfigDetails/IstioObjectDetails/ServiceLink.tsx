import * as React from 'react';
import { serverConfig } from '../../../config';
import { ServiceIcon } from '@patternfly/react-icons';
import { Link } from 'react-router-dom';

interface Props {
  namespace: string;
  host: string;
  isValid: boolean;
}

class ServiceLink extends React.PureComponent<Props> {
  emptyHost = (): boolean => {
    return !!this.props.host;
  };

  isFQDN = (): boolean => {
    return this.props.host.endsWith('.' + serverConfig.istioIdentityDomain);
  };

  isTwoPartsService = (): boolean => {
    const hostParts = this.hostParts();
    return hostParts.length === 2 && hostParts[1] === this.props.namespace;
  };

  isShortName = (): boolean => {
    return this.props.host.split('.').length === 1;
  };

  isWildCardScoped = (): boolean => {
    return this.props.host.startsWith('*');
  };

  showLink = (): boolean => {
    return (
      this.props.isValid &&
      !this.isWildCardScoped() &&
      (this.isFQDN() || this.isTwoPartsService() || this.isShortName())
    );
  };

  hostParts = (): string[] => {
    return this.props.host.split('.');
  };

  getHost = (): [string, string] => {
    // Shortname scenario
    let linkInfo: [string, string] = [this.props.namespace, this.props.host];

    // FQDN and TwoParts service
    if (this.isFQDN() || this.isTwoPartsService()) {
      const split = this.hostParts();
      linkInfo = [split[1], split[0]];
    }

    return linkInfo;
  };

  renderLink = () => {
    const link = this.getHost();
    //Render the actual link
    return (
      <Link to={'/namespaces/' + link[0] + '/services/' + link[1]}>
        {this.props.host + ' '}
        <ServiceIcon />
      </Link>
    );
  };

  render() {
    if (!this.emptyHost()) {
      return '-';
    }

    if (this.showLink()) {
      return this.renderLink();
    } else {
      return this.props.host;
    }
  }
}

export default ServiceLink;
