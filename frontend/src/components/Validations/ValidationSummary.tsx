import * as React from 'react';
import { StatusCondition, ValidationTypes } from '../../types/IstioObjects';
import { kialiStyle } from 'styles/StyleUtils';
import { Text, TextVariants, Tooltip, TooltipPosition } from '@patternfly/react-core';
import { Validation } from './Validation';

interface ValidationSummaryProps {
  errors: number;
  id: string;
  objectCount?: number;
  reconciledCondition?: StatusCondition;
  style?: React.CSSProperties;
  type: 'service' | 'istio';
  warnings: number;
}

const tooltipListStyle = kialiStyle({
  textAlign: 'left',
  border: 0,
  padding: 0,
  margin: 0
});

const tooltipSentenceStyle = kialiStyle({
  textAlign: 'center',
  border: 0,
  padding: 0,
  margin: 0
});

export const ValidationSummary: React.FC<ValidationSummaryProps> = (props: ValidationSummaryProps) => {
  const getTypeMessage = (count: number, type: ValidationTypes): string => {
    return count > 1 ? `${count} ${type}s found` : `${count} ${type} found`;
  };

  const severitySummary = (): string[] => {
    const issuesMessages: string[] = [];

    if (props.errors > 0) {
      issuesMessages.push(getTypeMessage(props.errors, ValidationTypes.Error));
    }

    if (props.warnings > 0) {
      issuesMessages.push(getTypeMessage(props.warnings, ValidationTypes.Warning));
    }

    if (issuesMessages.length === 0) {
      issuesMessages.push('No issues found');
    }

    return issuesMessages;
  };

  const severity = (): ValidationTypes => {
    let severity = ValidationTypes.Correct;

    if (props.errors > 0) {
      severity = ValidationTypes.Error;
    } else if (props.warnings > 0) {
      severity = ValidationTypes.Warning;
    }

    return severity;
  };

  let tooltipContent: React.ReactNode = undefined;

  if (props.type === 'istio') {
    const tooltipNA = <Text className={tooltipSentenceStyle}>No Istio config objects found</Text>;

    const tooltipNoValidationAvailable = <Text className={tooltipListStyle}>No Istio config validation available</Text>;

    const tooltipSummary = (
      <>
        <Text style={{ textAlign: 'left', textEmphasis: 'strong' }} component={TextVariants.p}>
          Istio config objects analyzed: {props.objectCount}
        </Text>

        <div className={tooltipListStyle}>
          {severitySummary().map(cat => (
            <div key={cat}>{cat}</div>
          ))}
        </div>

        {props.reconciledCondition?.status && (
          <Text style={{ textAlign: 'left', textEmphasis: 'strong' }} component={TextVariants.p}>
            The object is reconciled
          </Text>
        )}
      </>
    );

    // Tooltip Content for istio config validation
    if (props.objectCount !== undefined) {
      if (props.objectCount === 0) {
        tooltipContent = tooltipNA;
      } else {
        tooltipContent = tooltipSummary;
      }
    } else {
      tooltipContent = tooltipNoValidationAvailable;
    }
  } else {
    // Tooltip Content for service validation
    tooltipContent = (
      <>
        <Text style={{ textAlign: 'left', textEmphasis: 'strong' }} component={TextVariants.p}>
          Service validation result
        </Text>

        <div className={tooltipListStyle}>
          {severitySummary().map(cat => (
            <div key={cat}>{cat}</div>
          ))}
        </div>
      </>
    );
  }

  const tooltipBase =
    props.objectCount === undefined || props.objectCount > 0 ? (
      <Validation severity={severity()} />
    ) : (
      <div style={{ display: 'inline-block' }}>N/A</div>
    );

  return (
    <Tooltip aria-label="Validations list" position={TooltipPosition.auto} enableFlip={true} content={tooltipContent}>
      {tooltipBase}
    </Tooltip>
  );
};
