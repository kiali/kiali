import * as React from 'react';
import { serverConfig } from '../../config';
import { ControlPlaneVersionBadge } from '../Overview/ControlPlaneVersionBadge';

type PodRevisionProps = {
  annotations?: { [key: string]: string };
};

export const PodRevision: React.FC<PodRevisionProps> = (props: PodRevisionProps) => {
  if (props.annotations && props.annotations[serverConfig.istioLabels.injectionLabelRev]) {
    return (
      <>
        <ControlPlaneVersionBadge version={props.annotations[serverConfig.istioLabels.injectionLabelRev]} />
      </>
    );
  } else {
    return <></>;
  }
};
