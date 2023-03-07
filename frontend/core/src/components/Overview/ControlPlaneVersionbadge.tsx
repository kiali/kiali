import { Label } from '@patternfly/react-core';
import * as React from 'react';

type Props = {
  version: string;
  isCanary?: boolean;
  style?: React.CSSProperties
};

export const ControlPlaneVersionBadge = (props: Props) => {
    return (
        <Label style={props.style} color={props.isCanary ? 'blue' : 'orange'} isCompact>
          {props.version}
        </Label>
    );
};
