import * as React from 'react';
import { Paths } from '../../config';
import { PFBadge, PFBadges } from 'components/Pf/PfBadges';
import { TooltipPosition } from '@patternfly/react-core';
import {KioskLink} from "./KioskLink";

type Props = {
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
        <ServiceLinkItem name={name} namespace={namespace} query={query} />
      </>
    );
  }
}

class ServiceLinkItem extends React.Component<Props> {
  render() {
    const { name, namespace, query } = this.props;
    const href = getServiceURL(name, namespace, query);
    return (<KioskLink linkName={namespace + '/' + name} dataTest={'service-' + namespace + '-' + name} href={href}></KioskLink>)
  }
}
