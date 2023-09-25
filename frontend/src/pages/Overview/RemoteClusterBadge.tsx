import { Label } from '@patternfly/react-core';
import * as React from 'react';

export class RemoteClusterBadge extends React.Component {
  render() {
    return (
      <>
        <Label style={{ marginLeft: 5 }} color="grey" isCompact>
          Remote Cluster
        </Label>
      </>
    );
  }
}
