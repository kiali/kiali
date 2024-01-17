import * as React from 'react';
import { Tooltip, TooltipPosition } from '@patternfly/react-core';
import { SVGIconProps } from '@patternfly/react-icons/dist/js/createIcon';
import { isIstioNamespace } from 'config/ServerConfig';
import { icons } from 'config';
import { KialiIcon } from '../../config/KialiIcon';
import { kialiStyle } from 'styles/StyleUtils';

type MissingAuthPolicyProps = {
  text?: string;
  textTooltip?: string;
  tooltip?: boolean;
  icon?: React.ComponentClass<SVGIconProps>;
  color?: string;
  namespace: string;
  className?: string;
};

const infoStyle = kialiStyle({
  marginLeft: '0.5rem'
});

export const MissingAuthPolicy: React.FC<MissingAuthPolicyProps> = ({
  text = 'Missing Authorization Policy',
  textTooltip = 'This workload is not covered by any authorization policy.',
  tooltip = false,
  icon = icons.istio.missingAuthPolicy.icon,
  color = icons.istio.missingAuthPolicy.color,
  namespace,
  className
}) => {
  const iconComponent = (
    <span className={className}>
      {React.createElement(icon, { style: { color: color } })}

      {!tooltip && (
        <span style={{ marginLeft: '0.5rem' }}>
          {text}

          <Tooltip
            key="tooltip_missing_auth_policy"
            position={TooltipPosition.top}
            content={<div style={{ textAlign: 'left' }}>{textTooltip}</div>}
          >
            <KialiIcon.Info className={infoStyle} />
          </Tooltip>
        </span>
      )}
    </span>
  );

  if (isIstioNamespace(namespace)) {
    return <></>;
  }

  return tooltip ? (
    <Tooltip content={<div style={{ textAlign: 'left' }}>{textTooltip}</div>} position={TooltipPosition.right}>
      {iconComponent}
    </Tooltip>
  ) : (
    iconComponent
  );
};
