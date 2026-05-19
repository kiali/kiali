import * as React from 'react';
import { Paths } from '../../config';
import { PFBadge, PFBadges } from 'components/Pf/PfBadges';
import { TooltipPosition } from '@patternfly/react-core';
import { KialiLink } from './KialiLink';
import { isMultiCluster } from '../../config';

type ServiceLinkProps = {
  cluster?: string;
  isServiceEntry?: boolean;
  name: string;
  namespace: string;
  query?: string;
};

export const getServiceURL = (name: string, namespace: string, cluster?: string, query?: string): string => {
  let to = `/namespaces/${namespace}/${Paths.SERVICES}`;

  to = `${to}/${name}`;

  if (cluster && isMultiCluster) {
    to = `${to}?clusterName=${cluster}`;
  }

  if (!!query) {
    if (to.includes('?')) {
      to = `${to}&${query}`;
    } else {
      to = `${to}?${query}`;
    }
  }

  return to;
};

export const ServiceLink: React.FC<ServiceLinkProps> = (props: ServiceLinkProps) => {
  const { name, namespace, cluster, isServiceEntry, query } = props;

  return (
    <>
      <PFBadge badge={isServiceEntry ? PFBadges.ExternalService : PFBadges.Service} position={TooltipPosition.top} />
      <ServiceLinkItem
        name={name}
        namespace={namespace}
        cluster={cluster}
        isServiceEntry={isServiceEntry}
        query={query}
      />
    </>
  );
};

const ServiceLinkItem: React.FC<ServiceLinkProps> = (props: ServiceLinkProps) => {
  const { name, namespace, cluster, isServiceEntry, query } = props;
  const href = getServiceURL(name, namespace, cluster, query);
  const kioskParams = isServiceEntry ? 'type=External' : undefined;

  return (
    <KialiLink dataTest={`service-${namespace}-${name}`} to={href} kioskParams={kioskParams}>
      {`${namespace}/${name}`}
    </KialiLink>
  );
};
