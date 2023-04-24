import * as React from 'react';
import { isMultiCluster, Paths } from '../../config';
import { PFBadge, PFBadges } from 'components/Pf/PfBadges';
import { TooltipPosition } from '@patternfly/react-core';
import { KioskLink } from './KioskLink';

type Props = {
  name: string;
  namespace: string;
  cluster: string;
  query?: string;
};

export const getWorkloadLink = (name: string, namespace: string, cluster: string, query?: string): string => {
  let to = '/namespaces/' + namespace + '/' + Paths.WORKLOADS;

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

export class WorkloadLink extends React.Component<Props> {
  render() {
    const { name, namespace, cluster, query } = this.props;

    return (
      <>
        <PFBadge badge={PFBadges.Workload} position={TooltipPosition.top} />
        <WorkloadLinkItem namespace={namespace} name={name} cluster={cluster} query={query} />
      </>
    );
  }
}

class WorkloadLinkItem extends React.Component<Props> {
  render() {
    const { name, namespace, cluster, query } = this.props;
    const href = getWorkloadLink(name, namespace, cluster, query);
    return (
      <KioskLink
        linkName={namespace + '/' + name}
        // @TODO put cluster in link when all objects have multicluster support
        dataTest={'workload-' + namespace + '-' + name}
        href={href}
      ></KioskLink>
    );
  }
}
