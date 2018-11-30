import * as React from 'react';
import PropTypes from 'prop-types';
import { Icon } from 'patternfly-react';
import { ICONS } from '../../config';

const MissingSidecar = props => {
  const { style, text, type, name, color, ...otherProps } = props;
  return (
    <span style={style} {...otherProps}>
      <Icon type={type} name={name} style={{ color: color }} />
      <span style={{ marginLeft: '5px' }}>{text}</span>
    </span>
  );
};

MissingSidecar.propTypes = {
  text: PropTypes.string,
  type: PropTypes.string,
  name: PropTypes.string,
  color: PropTypes.string
};

MissingSidecar.defaultProps = {
  text: 'Missing Sidecar',
  type: ICONS().ISTIO.MISSING_SIDECAR.type,
  name: ICONS().ISTIO.MISSING_SIDECAR.name,
  color: ICONS().ISTIO.MISSING_SIDECAR.color
};

export default MissingSidecar;
