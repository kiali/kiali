import { Label } from '@patternfly/react-core';
import * as React from 'react';

class ControlPlaneBadge extends React.Component<{}> {
    render() {
        return (
            <Label style={{ marginLeft: 5 }} color="green" isCompact>Control Plane</Label>
        );
    }
}

export default ControlPlaneBadge;
