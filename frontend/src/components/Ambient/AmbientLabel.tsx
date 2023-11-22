import * as React from 'react';
import { Label, Tooltip, TooltipPosition } from '@patternfly/react-core';

type AmbientLabelProps = {
  style?: React.CSSProperties;
  tooltip: boolean;
  waypoint?: boolean;
};

const AmbientComponent = 'ztunnel';

export const AmbientLabel: React.FC<AmbientLabelProps> = (props: AmbientLabelProps) => {
  const msg = 'Component is labeled as part of the Istio Ambient Mesh';

  const tooltipContent = <div style={{ textAlign: 'left' }}>{msg}</div>;

  const iconComponent = (
    <span style={props.style}>
      <Label style={{ marginLeft: '0.5rem' }} color="blue" isCompact>
        {AmbientComponent}
      </Label>

      {props.waypoint && (
        <Label style={{ marginLeft: '0.5rem' }} color="blue" isCompact>
          Waypoint
        </Label>
      )}

      {!props.tooltip && (
        <span style={{ marginLeft: '1rem' }}>
          {msg}

          <Tooltip key="tooltip_ambient_label" position={TooltipPosition.top} content={tooltipContent}>
            <Label style={{ marginLeft: '0.5rem' }} color="blue" isCompact>
              {AmbientComponent}
            </Label>
          </Tooltip>
        </span>
      )}
    </span>
  );

  return props.tooltip ? (
    <Tooltip key="tooltip_ambient_label" position={TooltipPosition.right} content={tooltipContent}>
      {iconComponent}
    </Tooltip>
  ) : (
    iconComponent
  );
};
