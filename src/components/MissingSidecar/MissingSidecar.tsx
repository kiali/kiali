import * as React from 'react';
import { Tooltip, TooltipPosition } from '@patternfly/react-core';
import { IconType } from '@patternfly/react-icons/dist/js/createIcon';
import { isIstioNamespace } from 'config/ServerConfig';
import { icons } from 'config';

type MissingSidecarProps = {
  text: string;
  textTooltip: string;
  tooltip: boolean;
  icon: IconType;
  color: string;
  namespace: string;
  style?: React.CSSProperties;
};

const MissingSidecar = (props: MissingSidecarProps) => {
  const { text, textTooltip, icon, namespace, color, tooltip, style, ...otherProps } = props;

  const iconComponent = (
    <span style={style} {...otherProps}>
      {React.createElement(icon, { style: { color: color } })}
      {!tooltip && <span style={{ marginLeft: '5px' }}>{text}</span>}
    </span>
  );

  if (isIstioNamespace(namespace)) {
    return <></>;
  }

  return tooltip ? (
    <Tooltip content={<>{textTooltip}</>} position={TooltipPosition.right}>
      {iconComponent}
    </Tooltip>
  ) : (
    iconComponent
  );
};

MissingSidecar.defaultProps = {
  text: 'Missing Sidecar',
  textTooltip: 'Missing Sidecar',
  tooltip: false,
  icon: icons.istio.missingSidecar.icon,
  color: icons.istio.missingSidecar.color
};

export default MissingSidecar;
