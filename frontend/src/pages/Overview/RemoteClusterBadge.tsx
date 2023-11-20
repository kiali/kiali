import { Label } from '@patternfly/react-core';
import * as React from 'react';

export const RemoteClusterBadge: React.FC = () => {
  return (
    <Label style={{ marginLeft: '0.5rem' }} color="grey" isCompact>
      Remote Cluster
    </Label>
  );
};
