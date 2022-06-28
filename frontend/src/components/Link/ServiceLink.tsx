import * as React from 'react';
import { Paths } from '../../config';
import { Link } from 'react-router-dom';
import { PFBadge, PFBadges } from 'components/Pf/PfBadges';
import { TooltipPosition } from '@patternfly/react-core';

interface Props {
  name: string;
  namespace: string;
  query?: string;
}

export const getServiceURL = (name: string, namespace: string, query?: string): string => {
  let to = '/namespaces/' + namespace + '/' + Paths.SERVICES;

  to = to + '/' + name;

  if (!!query) {
    to = to + '?' + query;
  }

  return to;
};

export class ServiceLink extends React.Component<Props> {
  render() {
    const { name, namespace, query } = this.props;

    return (
      <>
        <PFBadge badge={PFBadges.Service} position={TooltipPosition.top} />
        <Link to={getServiceURL(name, namespace, query)} data-test={'service-' + namespace + '-' + name}>
          {namespace}/{name}
        </Link>
      </>
    );
  }
}

export default ServiceLink;
