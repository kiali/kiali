import * as React from 'react';
import PropTypes from 'prop-types';
import { Icon, OverlayTrigger, Tooltip } from 'patternfly-react';
import { icons } from '../../config';

const MissingSidecar = props => {
  const { style, text, textTooltip, type, name, color, tooltip, ...otherProps } = props;

  const iconComponent = (
    <span style={style} {...otherProps}>
      <Icon type={type} name={name} style={{ color: color }} />
      {!tooltip && <span style={{ marginLeft: '5px' }}>{text}</span>}
    </span>
  );
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
