import * as React from 'react';
import { Label as PfLabel } from 'patternfly-react';
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
        <PfLabel bsStyle="primary" className="label-key">
          {name}
        </PfLabel>
        <PfLabel bsStyle="primary" className="label-value">
          {value || ''}
        </PfLabel>
      </span>
    );
  } else {
    return <span>This label has an unexpected format</span>;
  }
};

export default Label;
