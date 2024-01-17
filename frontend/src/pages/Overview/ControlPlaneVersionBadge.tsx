import { Label } from '@patternfly/react-core';
import * as React from 'react';

type Props = {
  isCanary: boolean;
  version: string;
};

export const ControlPlaneVersionBadge: React.FC<Props> = (props: Props) => {
  return (
    <Label style={{ marginLeft: '0.5rem' }} color={props.isCanary ? 'blue' : 'orange'} isCompact>
      {props.version}
    </Label>
  );
};
