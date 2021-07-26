import React from 'react';
import { Tooltip, TooltipPosition } from '@patternfly/react-core';
import { ObjectCheck, ValidationTypes } from '../../types/IstioObjects';
import Validation from './Validation';
import { highestSeverity } from '../../types/ServiceInfo';

type Props = {
  checks?: ObjectCheck[];
  tooltipPosition?: TooltipPosition;
};

class ValidationList extends React.Component<Props> {
  content() {
    return (this.props.checks || []).map((check, index) => {
      return (
        <Validation
          key={'validation-check-' + index}
          severity={check.severity}
          message={(check.code ? check.code + ' ' : '') + check.message}
        />
      );
    });
  }

  render() {
    const severity = highestSeverity(this.props.checks || []);
    const isValid = severity === ValidationTypes.Correct;
    const tooltip = (
      <Tooltip
        aria-label={'Validations list'}
        position={this.props.tooltipPosition || TooltipPosition.left}
        enableFlip={true}
        content={isValid ? 'Valid' : this.content()}
      >
        <span>
          <Validation severity={severity} />
        </span>
      </Tooltip>
    );
    return tooltip;
  }
}

export default ValidationList;
