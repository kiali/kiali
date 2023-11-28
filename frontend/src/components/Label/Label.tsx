import * as React from 'react';
import { Label as PfLabel } from '@patternfly/react-core';
import { canRender } from '../../utils/SafeRender';
import { kialiStyle } from 'styles/StyleUtils';

interface Props {
  name: string;
  onClick?: () => void;
  style?: React.CSSProperties;
  value: string;
}

const labelStyle = kialiStyle({
  display: 'block',
  float: 'left',
  fontSize: 'var(--kiali-global--font-size)',
  margin: '0 0.25rem 0.25rem 0',
  maxWidth: '100%'
});

export const Label = (props: Props) => {
  const { name, value } = props;
  let label = 'This label has an unexpected format';

  if (canRender(name) && canRender(value)) {
    label = value && value.length > 0 ? `${name}=${value}` : name;
  }

  return (
    <PfLabel
      className={labelStyle}
      tooltipPosition="top"
      style={props.style}
      isCompact={true}
      onClick={props.onClick}
      textMaxWidth="500px"
    >
      {label}
    </PfLabel>
  );
};
