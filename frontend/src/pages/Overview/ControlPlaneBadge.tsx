import { Label } from '@patternfly/react-core';
import * as React from 'react';
import { IstioStatusInline } from '../../components/IstioStatus/IstioStatusInline';
import { serverConfig } from '../../config';
import { AmbientBadge } from '../../components/Ambient/AmbientBadge';
import { RemoteClusterBadge } from './RemoteClusterBadge';
import { isRemoteCluster } from './OverviewCardControlPlaneNamespace';

type Props = {
  cluster?: string;
  annotations?: { [key: string]: string };
};

export class ControlPlaneBadge extends React.Component<Props> {
  render() {
    return (
      <>
        <Label style={{ marginLeft: 5 }} color="green" isCompact>
          Control plane
        </Label>
        {isRemoteCluster(this.props.annotations) && <RemoteClusterBadge />}
        {serverConfig.ambientEnabled && (
          <AmbientBadge tooltip={'Istio Ambient ztunnel detected in the Control plane'}></AmbientBadge>
        )}{' '}
        <IstioStatusInline cluster={this.props.cluster} />
      </>
    );
  }
}
