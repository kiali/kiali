import * as React from 'react';
import PropTypes from 'prop-types';
import { Icon, OverlayTrigger, Tooltip } from 'patternfly-react';
import { ICONS } from '../../config';

const MissingSidecar = props => {
  const { style, text, type, name, color, tooltip, ...otherProps } = props;

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
          <strong>{text}</strong>
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
  tooltip: PropTypes.bool,
  type: PropTypes.string,
  name: PropTypes.string,
  color: PropTypes.string
};

MissingSidecar.defaultProps = {
  text: 'Missing Sidecar',
  tooltip: false,
  type: ICONS().ISTIO.MISSING_SIDECAR.type,
  name: ICONS().ISTIO.MISSING_SIDECAR.name,
  color: ICONS().ISTIO.MISSING_SIDECAR.color
};

export default MissingSidecar;
