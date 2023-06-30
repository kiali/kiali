import { Label } from '@patternfly/react-core';
import * as React from 'react';
import { IstioStatusInline } from '../../components/IstioStatus/IstioStatusInline';
import { serverConfig } from '../../config';
import { AmbientBadge } from '../../components/Ambient/AmbientBadge';

type Props = {
  cluster?: string;
};

export class ControlPlaneBadge extends React.Component<Props> {
  render() {
    return (
      <>
        <Label style={{ marginLeft: 5 }} color="green" isCompact>
          Control plane
        </Label>
        {serverConfig.ambientEnabled && <AmbientBadge tooltip={true}></AmbientBadge>}{' '}
        <IstioStatusInline cluster={this.props.cluster} />
      </>
    );
  }
}
