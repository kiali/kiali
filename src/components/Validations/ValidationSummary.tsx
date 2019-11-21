import * as React from 'react';
import { CSSProperties } from 'react';
import { ValidationTypes } from '../../types/IstioObjects';
import { style } from 'typestyle';
import { Text, TextVariants, Tooltip, TooltipPosition } from '@patternfly/react-core';
import Validation, { severityToValidation } from './Validation';

interface Props {
  id: string;
  errors: number;
  warnings: number;
  style?: CSSProperties;
}

const tooltipListStyle = style({
  textAlign: 'left',
  border: 0,
  padding: '0 0 0 1em',
  margin: '0 0 0 0'
});

export class ValidationSummary extends React.PureComponent<Props> {
  getTypeMessage = (count: number, type: ValidationTypes): string => {
    return count > 1 ? `${count} ${type}s found` : `${count} ${type} found`;
  };

  severitySummary() {
    const issuesMessages: string[] = [];

    if (this.props.errors > 0) {
      issuesMessages.push(this.getTypeMessage(this.props.errors, ValidationTypes.Error));
    }

    if (this.props.warnings > 0) {
      issuesMessages.push(this.getTypeMessage(this.props.warnings, ValidationTypes.Warning));
    }

    if (issuesMessages.length === 0) {
      issuesMessages.push('No issues found');
    }

    return issuesMessages;
  }

  severity() {
    let severity = ValidationTypes.Correct;
    if (this.props.errors > 0) {
      severity = ValidationTypes.Error;
    } else if (this.props.warnings > 0) {
      severity = ValidationTypes.Warning;
    }

    return severity;
  }

  tooltipContent() {
    const validation = severityToValidation[this.severity()];
    return (
      <>
        <Text style={{ textAlign: 'left', textEmphasis: 'strong' }} component={TextVariants.h4}>
          Istio Config Validation
        </Text>
        <Text style={{ textAlign: 'left', textEmphasis: 'strong', paddingLeft: '1em' }}>{validation.name}</Text>
        <div className={tooltipListStyle}>
          {this.severitySummary().map(cat => (
            <div key={cat}>{cat}</div>
          ))}
        </div>
      </>
    );
  }

  render() {
    return (
      <Tooltip
        aria-label={'Validations list'}
        position={TooltipPosition.auto}
        enableFlip={true}
        content={this.tooltipContent()}
      >
        <Validation iconStyle={this.props.style} severity={this.severity()} />
      </Tooltip>
    );
  }
}

export default ValidationSummary;
