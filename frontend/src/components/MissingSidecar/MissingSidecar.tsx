import * as React from 'react';
import { Tooltip, TooltipPosition } from '@patternfly/react-core';
import { SVGIconProps } from '@patternfly/react-icons/dist/js/createIcon';
import { isIstioNamespace, serverConfig } from 'config/ServerConfig';
import { icons } from 'config';
import { KialiIcon } from '../../config/KialiIcon';
import { kialiStyle } from 'styles/StyleUtils';

type MissingSidecarProps = {
  className?: string;
  color?: string;
  dataTest?: string;
  icon?: React.ComponentClass<SVGIconProps>;
  isGateway?: boolean;
  meshtooltip?: string;
  namespace: string;
  text?: string;
  textmesh?: string;
  texttooltip?: string;
  tooltip?: boolean;
};

const infoStyle = kialiStyle({
  marginLeft: '0.5rem'
});

export const MissingSidecar: React.FC<MissingSidecarProps> = ({
  textmesh = 'Out of mesh',
  text = 'Missing Sidecar',
  meshtooltip = 'Out of mesh. Istio sidecar container or Ambient labels not found in Pod(s). Check if the istio-injection label/annotation is correctly set on the namespace/workload.',
  texttooltip = 'Istio sidecar container not found in Pod(s). Check if the istio-injection label/annotation is correctly set on the namespace/workload.',
  tooltip = false,
  icon = icons.istio.missingSidecar.icon,
  color = icons.istio.missingSidecar.color,
  className,
  dataTest,
  namespace,
  isGateway
}) => {
  const iconComponent = (
    <span className={className} data-test={dataTest}>
      {React.createElement(icon, { style: { color: color } })}

      {!tooltip && (
        <span style={{ marginLeft: '0.5rem' }}>
          {serverConfig.ambientEnabled ? textmesh : text}
          <Tooltip
            key="tooltip_missing_sidecar"
            position={TooltipPosition.top}
            content={<div style={{ textAlign: 'left' }}>{serverConfig.ambientEnabled ? meshtooltip : texttooltip}</div>}
          >
            <KialiIcon.Info className={infoStyle} />
          </Tooltip>
        </span>
      )}
    </span>
  );

  if (isIstioNamespace(namespace) || isGateway) {
    return <></>;
  }

  return tooltip ? (
    <Tooltip
      content={<div style={{ textAlign: 'left' }}>{serverConfig.ambientEnabled ? meshtooltip : texttooltip}</div>}
      position={TooltipPosition.right}
    >
      {iconComponent}
    </Tooltip>
  ) : (
    iconComponent
  );
};
