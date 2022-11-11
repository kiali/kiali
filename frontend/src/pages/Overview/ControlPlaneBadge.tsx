import { Label } from '@patternfly/react-core';
import * as React from 'react';
import IstioStatusInline from "../../components/IstioStatus/IstioStatusInline";

class ControlPlaneBadge extends React.Component<{}> {
    render() {
        return (
            <>
              <Label style={{ marginLeft: 5 }} color="green" isCompact>Control plane</Label>
              {' '} <IstioStatusInline />
            </>
        );
    }
}

export default ControlPlaneBadge;
