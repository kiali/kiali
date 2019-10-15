import * as React from 'react';
import PropTypes from 'prop-types';
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
  style?: any;
};

const MissingSidecar = (props: MissingSidecarProps) => {
  const { text, textTooltip, icon, namespace, color, tooltip, ...otherProps } = props;

  const iconComponent = (
    <span {...otherProps}>
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

MissingSidecar.propTypes = {
  text: PropTypes.string,
  textTooltip: PropTypes.string,
  tooltip: PropTypes.bool,
  type: PropTypes.string,
  name: PropTypes.string,
  color: PropTypes.string
};

MissingSidecar.defaultProps = {
  text: 'Missing Sidecar',
  textTooltip: 'Missing Sidecar',
  tooltip: false,
  icon: icons.istio.missingSidecar.icon,
  color: icons.istio.missingSidecar.color
};

export default MissingSidecar;
