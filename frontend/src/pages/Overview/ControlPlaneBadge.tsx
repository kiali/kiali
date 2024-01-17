import { Label } from '@patternfly/react-core';
import * as React from 'react';
import { IstioStatusInline } from '../../components/IstioStatus/IstioStatusInline';
import { serverConfig } from '../../config';
import { AmbientBadge } from '../../components/Ambient/AmbientBadge';
import { RemoteClusterBadge } from './RemoteClusterBadge';
import { isRemoteCluster } from './OverviewCardControlPlaneNamespace';

type Props = {
  annotations?: { [key: string]: string };
  cluster?: string;
};

export const ControlPlaneBadge: React.FC<Props> = (props: Props) => {
  return (
    <>
      <Label style={{ marginLeft: '0.5rem' }} color="green" isCompact>
        Control plane
      </Label>

      {isRemoteCluster(props.annotations) && <RemoteClusterBadge />}

      {serverConfig.ambientEnabled && (
        <AmbientBadge tooltip="Istio Ambient ztunnel detected in the Control plane"></AmbientBadge>
      )}

      <IstioStatusInline cluster={props.cluster} />
    </>
  );
};
