import * as React from 'react';
import { PopoverPosition, Tooltip } from '@patternfly/react-core';
import { HealthDetails } from './HealthDetails';
import * as H from '../../types/Health';
import { createIcon, createTooltipIcon } from '../../config/KialiIcon';
import { healthIndicatorStyle } from '../../styles/HealthStyle';

interface HealthIndicatorProps {
  health?: H.Health;
  id: string;
  tooltipPlacement?: PopoverPosition;
}

export const HealthIndicator: React.FC<HealthIndicatorProps> = (props: HealthIndicatorProps) => {
  const globalStatus = props.health ? props.health.getGlobalStatus() : H.NA;

  if (props.health) {
    const icon = createIcon(globalStatus);

    return (
      <Tooltip
        aria-label="Health indicator"
        content={
          <div>
            <strong>{globalStatus.name}</strong>
            <HealthDetails health={props.health} />
          </div>
        }
        position={PopoverPosition.auto}
        className={healthIndicatorStyle}
      >
        {createTooltipIcon(icon)}
      </Tooltip>
    );
  }

  return <span />;
};
