import React from 'react';
import { Tooltip, TooltipPosition } from '@patternfly/react-core';
import { ObjectCheck, ValidationTypes } from '../../types/IstioObjects';
import { Validation } from './Validation';
import { highestSeverity } from '../../types/ServiceInfo';

type ValidationListProps = {
  checks?: ObjectCheck[];
  tooltipPosition?: TooltipPosition;
};

export const ValidationList: React.FC<ValidationListProps> = (props: ValidationListProps) => {
  const content = (props.checks ?? []).map((check, index) => {
    return (
      <Validation
        key={`validation-check-${index}`}
        severity={check.severity}
        message={`${check.code ? `${check.code} ` : ''}${check.message}`}
      />
    );
  });

  const severity = highestSeverity(props.checks ?? []);
  const isValid = severity === ValidationTypes.Correct;

  const tooltip = (
    <Tooltip
      aria-label="Validations list"
      position={props.tooltipPosition ?? TooltipPosition.left}
      enableFlip={true}
      content={isValid ? 'Valid' : content}
    >
      <span>
        <Validation severity={severity} />
      </span>
    </Tooltip>
  );

  return tooltip;
};
