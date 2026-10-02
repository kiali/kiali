import * as React from 'react';
import { Tooltip, TooltipPosition } from '@patternfly/react-core';
import type { SVGIconProps } from '@patternfly/react-icons/dist/js/createIcon';
import { serverConfig } from 'config/ServerConfig';
import { icons } from 'config';
import { KialiIcon } from '../../config/KialiIcon';
import { infoStyle } from 'styles/IconStyle';
import { useKialiTranslation } from 'utils/I18nUtils';

const missingSidecarText = 'Missing Sidecar';
const outOfMeshText = 'Out of mesh';
const missingSidecarTooltip =
  'Istio sidecar container not found in Pod(s). Check if the istio-injection label/annotation is correctly set on the namespace/workload.';
const outOfMeshTooltip =
  'Out of mesh. Istio sidecar container or Ambient labels not found in Pod(s). Check if the istio-injection label/annotation is correctly set on the namespace/workload.';

type MissingSidecarProps = {
  className?: string;
  color?: string;
  dataTest?: string;
  icon?: React.ComponentClass<SVGIconProps>;
  meshtooltip?: string;
  text?: string;
  textmesh?: string;
  texttooltip?: string;
  tooltip?: boolean;
};

export const MissingSidecar: React.FC<MissingSidecarProps> = ({
  textmesh = outOfMeshText,
  text = missingSidecarText,
  meshtooltip = outOfMeshTooltip,
  texttooltip = missingSidecarTooltip,
  tooltip = false,
  icon = icons.istio.missingSidecar.icon,
  color = icons.istio.missingSidecar.color,
  className,
  dataTest
}) => {
  const { t } = useKialiTranslation();
  const label = serverConfig.ambientEnabled ? textmesh : text;
  const translatedLabel = label === '' ? '' : t(label);
  const translatedTooltip = t(serverConfig.ambientEnabled ? meshtooltip : texttooltip);

  const iconComponent = (
    <span className={className} data-test={dataTest}>
      {React.createElement(icon, { style: { color: color } })}

      {!tooltip && (
        <span style={{ marginLeft: '0.5rem' }}>
          {translatedLabel}
          <Tooltip
            key="tooltip_missing_sidecar"
            position={TooltipPosition.top}
            content={<div style={{ textAlign: 'left' }}>{translatedTooltip}</div>}
          >
            <KialiIcon.Info className={infoStyle} />
          </Tooltip>
        </span>
      )}
    </span>
  );

  return tooltip ? (
    <Tooltip content={<div style={{ textAlign: 'left' }}>{translatedTooltip}</div>} position={TooltipPosition.right}>
      {iconComponent}
    </Tooltip>
  ) : (
    iconComponent
  );
};
