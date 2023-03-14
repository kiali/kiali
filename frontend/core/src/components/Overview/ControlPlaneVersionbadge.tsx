import { Label } from '@patternfly/react-core';
import * as React from 'react';

export type ControlPlaneVersionBadgeProps = {
  version: string;
  isCanary?: boolean;
  style?: React.CSSProperties
};

export const ControlPlaneVersionBadge = (props: ControlPlaneVersionBadgeProps) => {
    return (
        <Label style={props.style} color={props.isCanary ? 'blue' : 'orange'} isCompact>
          {props.version}
        </Label>
    );
};
