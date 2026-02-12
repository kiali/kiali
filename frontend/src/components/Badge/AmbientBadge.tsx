import * as React from 'react';
import { Label, Tooltip, TooltipPosition } from '@patternfly/react-core';
import { t } from 'i18next';

type AmbientLabelProps = {
  style?: React.CSSProperties;
  tooltip?: string;
};

export const AmbientBadge: React.FC<AmbientLabelProps> = (props: AmbientLabelProps) => {
  const tooltipContent = <div style={{ textAlign: 'left' }}>{props.tooltip}</div>;

  const iconComponent = (
    <Label style={{ marginLeft: '0.5rem', ...props.style }} color="blue" isCompact data-test="ambient-badge">
      {t('Ambient')}
    </Label>
  );

  return props.tooltip ? (
    <Tooltip key="tooltip_ambient_label" position={TooltipPosition.right} content={tooltipContent}>
      {iconComponent}
    </Tooltip>
  ) : (
    iconComponent
  );
};
