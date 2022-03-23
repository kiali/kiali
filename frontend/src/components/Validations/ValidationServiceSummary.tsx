import * as React from 'react';
import { ObjectValidation, ValidationTypes } from '../../types/IstioObjects';
import ServiceValidationSummary from './ServiceValidationSummary';
import { CSSProperties } from 'react';

interface Props {
  id: string;
  validations: ObjectValidation[];
  style?: CSSProperties;
}

export class ValidationServiceSummary extends React.PureComponent<Props> {
  numberOfChecks = (type: ValidationTypes) => {
    let numCheck = 0;
    this.props.validations.forEach(validation => {
      if (validation.checks) {
        numCheck += validation.checks.filter(i => i.severity === type).length;
      }
    });
    return numCheck;
  };

  render() {
    return (
      <ServiceValidationSummary
        id={this.props.id}
        errors={this.numberOfChecks(ValidationTypes.Error)}
        warnings={this.numberOfChecks(ValidationTypes.Warning)}
        style={this.props.style}
      />
    );
  }
}
