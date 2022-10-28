import { Label } from '@patternfly/react-core';
import * as React from 'react';

type Props = {
    version: string;
    isCanary: boolean;
};

class ControlPlaneVersionBadge extends React.Component<Props> {
    render() {
        return (
            <>
              <Label style={{ marginLeft: 5 }} color={this.props.isCanary ? "blue": "orange"} isCompact>{this.props.version}</Label>
            </>
        );
    }
}

export default ControlPlaneVersionBadge;
