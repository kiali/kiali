import * as React from 'react';
import { Label, Tooltip, TooltipPosition } from '@patternfly/react-core';

type AmbientLabelProps = {
  tooltip: boolean;
  style?: React.CSSProperties;
  message?: string;
};

export class AmbientBadge extends React.Component<AmbientLabelProps, {}> {
  render() {
    const msg = this.props.message ? this.props.message : 'Istio Ambient ztunnel detected in the Control plane';

    const tooltipContent = (
      <div style={{ textAlign: 'left' }}>
        <>
          <div>
            {msg}
            <br />
          </div>
        </>
      </div>
    );
    const iconComponent = (
      <span style={this.props.style}>
        <Label style={{ marginLeft: 5 }} color="blue" isCompact>
          Ambient
        </Label>
        {!this.props.tooltip && (
          <span style={{ marginLeft: '8px' }}>
            {msg}
            <Tooltip key={`tooltip_ambient_label`} position={TooltipPosition.top} content={tooltipContent}>
              <Label style={{ marginLeft: 5 }} color="blue" isCompact>
                Ambient
              </Label>
            </Tooltip>
          </span>
        )}
      </span>
    );
    return this.props.tooltip ? (
      <Tooltip key={`tooltip_ambient_label`} position={TooltipPosition.right} content={tooltipContent}>
        {iconComponent}
      </Tooltip>
    ) : (
      iconComponent
    );
  }
}
