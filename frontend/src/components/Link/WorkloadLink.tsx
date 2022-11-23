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

export const getWorkloadLink = (name: string, namespace: string, query?: string): string => {
  let to = '/namespaces/' + namespace + '/' + Paths.WORKLOADS;

  to = to + '/' + name;

  if (!!query) {
    to = to + '?' + query;
  }

  return to;
};

export class WorkloadLink extends React.Component<Props> {
  render() {
    const { name, namespace, query } = this.props;

    return (
      <>
        <PFBadge badge={PFBadges.Workload} position={TooltipPosition.top} />
        <WorkloadLinkItem namespace={namespace} name={name} query={query} />
      </>
    );
  }
}

class WorkloadLinkItem extends React.Component<Props> {
  render() {
    const { name, namespace, query } = this.props;
    const href = getWorkloadLink(name, namespace, query);
    return (<KioskLink linkName={namespace + '/' + name} dataTest={'workload-' + namespace + '-' + name} href={href}></KioskLink>)
  }
}
