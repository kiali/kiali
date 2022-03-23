import * as React from 'react';
import { Label as PfLabel } from '@patternfly/react-core';
import './Label.css';
import { canRender } from '../../utils/SafeRender';

interface Props {
  name: string;
  value: string;
}

const Label = (props: Props) => {
  const { name, value } = props;

  if (canRender(name) && canRender(value)) {
    return (
      <span className="label-pair">
        <PfLabel className="label-key" isCompact={true}>
          {name}
        </PfLabel>
        {value && value.length > 0 && (
          <PfLabel className="label-value" isCompact={true}>
            {value || ''}
          </PfLabel>
        )}
      </span>
    );
  } else {
    return <span>This label has an unexpected format</span>;
  }
};

export default Label;
