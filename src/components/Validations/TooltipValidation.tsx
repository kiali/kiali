import React from 'react';
import { Tooltip, TooltipPosition } from '@patternfly/react-core';
import { ObjectCheck, ValidationTypes } from '../../types/IstioObjects';
import Validation from './Validation';
import { highestSeverity } from '../../types/ServiceInfo';

type Props = {
  checks?: ObjectCheck[];
  showValid?: boolean;
  tooltipPosition?: TooltipPosition;
};

class TooltipValidation extends React.Component<Props> {
  content() {
    return (this.props.checks || []).map((check, index) => {
      return <Validation key={'validation-check-' + index} severity={check.severity} message={check.message} />;
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
        content={this.content()}
      >
        <Validation severity={severity} />
      </Tooltip>
    );

    if (!isValid || (isValid && this.props.showValid)) {
      return tooltip;
    } else {
      return '';
    }
  }
}

export default TooltipValidation;
