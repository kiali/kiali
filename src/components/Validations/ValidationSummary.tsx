import * as React from 'react';
import { ObjectValidation, ValidationTypes } from '../../types/IstioObjects';
import { style } from 'typestyle';
import { Text, TextVariants, Tooltip, TooltipPosition } from '@patternfly/react-core';
import Validation, { severityToValidation } from './Validation';
import { higherSeverity, highestSeverity } from '../../types/ServiceInfo';

interface Props {
  id: string;
  validations: ObjectValidation[];
  definition?: boolean;
  size?: string;
}

const tooltipListStyle = style({
  border: 0,
  padding: '0 0 0 0',
  margin: '0 0 0 0'
});

export class ValidationSummary extends React.PureComponent<Props> {
  numberOfChecks = (type: string) => {
    let numCheck = 0;
    this.props.validations.forEach(validation => {
      if (validation.checks) {
        numCheck += validation.checks.filter(i => i.severity === type).length;
      }
    });
    return numCheck;
  };

  getTypeMessage = (type: string) => {
    const numberType = this.numberOfChecks(type);
    return numberType > 0
      ? numberType > 1
        ? `${numberType} ${type}s found`
        : `${numberType} ${type} found`
      : undefined;
  };

  checkCount() {
    return this.props.validations.reduce((sum, current) => {
      return sum + (current.checks ? current.checks.length : 0);
    }, 0);
  }

  severitySummary() {
    const issuesMessages: string[] = [];

    if (this.props.validations.length > 0) {
      const errMessage = this.getTypeMessage('error');
      if (errMessage) {
        issuesMessages.push(errMessage);
      }
      const warnMessage = this.getTypeMessage('warning');
      if (warnMessage) {
        issuesMessages.push(warnMessage);
      }
    }

    if (issuesMessages.length === 0) {
      issuesMessages.push('No issues found');
    }

    return issuesMessages;
  }

  validationInfo() {
    const numChecks = this.checkCount();
    const validationsInfo: JSX.Element[] = [];
    const showDefinitions = this.props.definition && numChecks !== 0;
    if (showDefinitions) {
      this.props.validations.forEach(validation => {
        validationsInfo.push(
          <div style={{ paddingLeft: '10px' }} key={validation.name}>
            {validation.name} : {validation.checks.map(check => check.message).join(',')}
          </div>
        );
      });
    }
    return validationsInfo;
  }

  severity() {
    let severity = ValidationTypes.Correct;

    this.props.validations.forEach(validation => {
      const valSeverity = validation.checks ? highestSeverity(validation.checks) : ValidationTypes.Correct;
      if (higherSeverity(valSeverity, severity)) {
        severity = valSeverity;
      }
    });

    return severity;
  }

  tooltipContent() {
    const validation = severityToValidation[this.severity()];
    return (
      <>
        <Text component={TextVariants.h4}>
          <strong>{validation.name}</strong>
        </Text>
        <div className={tooltipListStyle}>
          {this.severitySummary().map(cat => (
            <div className={tooltipListStyle} key={cat}>
              {cat}
            </div>
          ))}
          {this.validationInfo()}
        </div>
      </>
    );
  }

  render() {
    return (
      <Tooltip
        aria-label={'Validations list'}
        position={TooltipPosition.left}
        enableFlip={true}
        content={this.tooltipContent()}
      >
        <div style={{ float: 'left' }}>
          <Validation severity={this.severity()} />
        </div>
      </Tooltip>
    );
  }
}
