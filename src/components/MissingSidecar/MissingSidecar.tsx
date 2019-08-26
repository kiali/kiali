import * as React from 'react';
import PropTypes from 'prop-types';
import { Icon, OverlayTrigger, Tooltip } from 'patternfly-react';
import { isIstioNamespace } from 'config/ServerConfig';
import { icons } from 'config';

type MissingSidecarProps = {
  text: string;
  textTooltip: string;
  tooltip: boolean;
  type: string;
  name: string;
  color: string;
  namespace: string;
  style?: any;
};

const MissingSidecar = (props: MissingSidecarProps) => {
  const { text, textTooltip, type, name, namespace, color, tooltip, ...otherProps } = props;

  const iconComponent = (
    <span {...otherProps}>
      <Icon type={type} name={name} style={{ color: color }} />
      {!tooltip && <span style={{ marginLeft: '5px' }}>{text}</span>}
    </span>
  );

  if (isIstioNamespace(namespace)) {
    return <></>;
  }

  return tooltip ? (
    <OverlayTrigger
      overlay={
        <Tooltip>
          <strong>{textTooltip}</strong>
        </Tooltip>
      }
      placement="right"
      trigger={['hover', 'focus']}
      rootClose={false}
    >
      {iconComponent}
    </OverlayTrigger>
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
  type: icons.istio.missingSidecar.type,
  name: icons.istio.missingSidecar.name,
  color: icons.istio.missingSidecar.color
};

export default MissingSidecar;
