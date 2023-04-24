import * as React from 'react';
import { Paths } from '../../config';
import { PFBadge, PFBadges } from 'components/Pf/PfBadges';
import { TooltipPosition } from '@patternfly/react-core';
import { KioskLink } from './KioskLink';
import { isMultiCluster } from '../../config';

type Props = {
  name: string;
  namespace: string;
  cluster: string;
  query?: string;
};

export const getServiceURL = (name: string, namespace: string, cluster: string, query?: string): string => {
  let to = '/namespaces/' + namespace + '/' + Paths.SERVICES;

  to = to + '/' + name;

  if (cluster && isMultiCluster()) {
    to = to + '?cluster=' + cluster;
  }

  if (!!query) {
    if (to.includes('?')) {
      to = to + '&' + query;
    } else {
      to = to + '?' + query;
    }
  }

  return to;
};

export class ServiceLink extends React.Component<Props> {
  render() {
    const { name, namespace, cluster, query } = this.props;

    return (
      <>
        <PFBadge badge={PFBadges.Service} position={TooltipPosition.top} />
        <ServiceLinkItem name={name} namespace={namespace} cluster={cluster} query={query} />
      </>
    );
  }
}

class ServiceLinkItem extends React.Component<Props> {
  render() {
    const { name, namespace, cluster, query } = this.props;
    const href = getServiceURL(name, namespace, cluster, query);
    return (
      <KioskLink
        linkName={namespace + '/' + name}
        dataTest={'service-' + namespace + '-' + name}
        href={href}
      ></KioskLink>
    );
  }
}
