import * as React from 'react';
import { CSSProperties } from 'react';
import { StatusCondition, ValidationTypes } from '../../types/IstioObjects';
import { kialiStyle } from 'styles/StyleUtils';
import { Text, TextVariants, Tooltip, TooltipPosition } from '@patternfly/react-core';
import { Validation } from './Validation';

interface Props {
  id: string;
  reconciledCondition?: StatusCondition;
  errors: number;
  warnings: number;
  objectCount?: number;
  style?: CSSProperties;
}

const tooltipListStyle = kialiStyle({
  textAlign: 'left',
  border: 0,
  padding: '0 0 0 0',
  margin: '0 0 0 0'
});

const tooltipSentenceStyle = kialiStyle({
  textAlign: 'center',
  border: 0,
  padding: '0 0 0 0',
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

  tooltipNA() {
    return <Text className={tooltipSentenceStyle}>No Istio config objects found</Text>;
  }

  tooltipNoValidationAvailable() {
    return <Text className={tooltipListStyle}>No Istio config validation available</Text>;
  }

  tooltipSummary() {
    return (
      <>
        <Text style={{ textAlign: 'left', textEmphasis: 'strong' }} component={TextVariants.p}>
          Istio config objects analyzed: {this.props.objectCount}
        </Text>
        <div className={tooltipListStyle}>
          {this.severitySummary().map(cat => (
            <div key={cat}>{cat}</div>
          ))}
        </div>
        {this.props.reconciledCondition?.status && (
          <Text style={{ textAlign: 'left', textEmphasis: 'strong' }} component={TextVariants.p}>
            The object is reconciled
          </Text>
        )}
      </>
    );
  }

  tooltipContent() {
    if (this.props.objectCount !== undefined) {
      if (this.props.objectCount === 0) {
        return this.tooltipNA();
      } else {
        return this.tooltipSummary();
      }
    } else {
      return this.tooltipNoValidationAvailable();
    }
  }

  tooltipBase() {
    return this.props.objectCount === undefined || this.props.objectCount > 0 ? (
      <Validation iconStyle={this.props.style} severity={this.severity()} />
    ) : (
      <div style={{ display: 'inline-block', marginLeft: '5px' }}>N/A</div>
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
        {this.tooltipBase()}
      </Tooltip>
    );
  }
}
