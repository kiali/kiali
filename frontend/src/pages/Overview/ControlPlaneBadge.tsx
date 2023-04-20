import { Label } from '@patternfly/react-core';
import * as React from 'react';
import IstioStatusInline from '../../components/IstioStatus/IstioStatusInline';
import { serverConfig } from '../../config';
import AmbientBadge from '../../components/Ambient/AmbientBadge';

class ControlPlaneBadge extends React.Component<{}> {
  render() {
    return (
      <>
        <Label style={{ marginLeft: 5 }} color="green" isCompact>
          Control plane
        </Label>
        {serverConfig.ambientEnabled && <AmbientBadge tooltip={true}></AmbientBadge>} <IstioStatusInline />
      </>
    );
  }
}

export default ControlPlaneBadge;
