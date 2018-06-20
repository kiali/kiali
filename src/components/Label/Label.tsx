import * as React from 'react';
import { Label as PfLabel } from 'patternfly-react';
import './Label.css';

interface LabelProps {
  name: string;
  value: string;
}

class Label extends React.Component<LabelProps> {
  render() {
    return (
      <span className="label-pair">
        <PfLabel bsStyle="primary" className="label-key">
          {this.props.name}
        </PfLabel>
        <PfLabel bsStyle="primary" className="label-value">
          {this.props.value || ''}
        </PfLabel>
      </span>
    );
  }
}

export default Label;
