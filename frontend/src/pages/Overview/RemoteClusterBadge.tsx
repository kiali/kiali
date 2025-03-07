import { Label, Tooltip, TooltipPosition } from '@patternfly/react-core';
import * as React from 'react';
import { PFBadge, PFBadges } from '../../components/Pf/PfBadges';
import { kialiStyle } from '../../styles/StyleUtils';

type Props = {
  cluster?: string;
};

const clusterStyle = kialiStyle({
  display: 'flex',
  alignItems: 'center',
  textAlign: 'left'
});

export const RemoteClusterBadge: React.FC<Props> = (props: Props) => {
  const tooltipContent = (
    <div className={clusterStyle}>
      <PFBadge badge={PFBadges.Cluster} size="sm" />
      {props.cluster}
    </div>
  );
  const textComponent = (
    <Label style={{ marginLeft: '0.5rem' }} color="grey" isCompact>
      Remote Cluster
    </Label>
  );
  return props.cluster ? (
    <Tooltip key="tooltip_ambient_label" position={TooltipPosition.right} content={tooltipContent}>
      {textComponent}
    </Tooltip>
  ) : (
    textComponent
  );
};
