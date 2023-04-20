import * as React from 'react';
import { Label, Tooltip, TooltipPosition } from '@patternfly/react-core';

type AmbientLabelProps = {
  tooltip: boolean;
  style?: React.CSSProperties;
  waypoint?: boolean;
};

const AmbientComponent = 'ztunnel';

class AmbientLabel extends React.Component<AmbientLabelProps, {}> {
  render() {
    const msg = 'Component is labeled as part of the Istio Ambient Mesh';

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
          {AmbientComponent}
        </Label>
        {this.props.waypoint && (
          <Label style={{ marginLeft: 5 }} color="blue" isCompact>
            Waypoint
          </Label>
        )}
        {!this.props.tooltip && (
          <span style={{ marginLeft: '8px' }}>
            {msg}
            <Tooltip key={`tooltip_ambient_label`} position={TooltipPosition.top} content={tooltipContent}>
              <Label style={{ marginLeft: 5 }} color="blue" isCompact>
                {AmbientComponent}
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

export default AmbientLabel;
