import * as React from 'react';
import { Label as PfLabel } from '@patternfly/react-core';
import { canRender } from '../../utils/SafeRender';
import { style } from 'typestyle';

interface Props {
  name: string;
  onClick?: () => void;
  style?: React.CSSProperties;
  value: string;
}

const labelStyle = style({
  display: 'block',
  float: 'left',
  fontSize: 'var(--kiali-global--font-size)',
  margin: '0 2px 2px 0',
  maxWidth: '100%'
});

const Label = (props: Props) => {
  const { name, value } = props;
  let label = 'This label has an unexpected format';

  if (canRender(name) && canRender(value)) {
    label = value && value.length > 0 ? `${name}=${value}` : name;
  }

  return (
    <PfLabel className={labelStyle} style={props.style} isCompact={true} onClick={props.onClick}>
      {label}
    </PfLabel>
  );
};

export default Label;
