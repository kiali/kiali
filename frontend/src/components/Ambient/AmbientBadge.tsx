import * as React from 'react';
import { Label, Tooltip, TooltipPosition } from '@patternfly/react-core';

type AmbientLabelProps = {
  style?: React.CSSProperties;
  tooltip: string;
};

export const AmbientBadge: React.FC<AmbientLabelProps> = (props: AmbientLabelProps) => {
  const tooltipContent = (
    <div style={{ textAlign: 'left' }}>
      <>
        <div>
          {props.tooltip}
          <br />
        </div>
      </>
    </div>
  );

  const iconComponent = (
    <span style={props.style}>
      <Label style={{ marginLeft: '0.5rem' }} color="blue" isCompact>
        Ambient
      </Label>
    </span>
  );

  return (
    <Tooltip key={`tooltip_ambient_label`} position={TooltipPosition.right} content={tooltipContent}>
      {iconComponent}
    </Tooltip>
  );
};
