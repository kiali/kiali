import * as React from 'react';
import { Tooltip, TooltipPosition } from '@patternfly/react-core';
import type { ObjectCheck } from '../../types/IstioObjects';
import { ValidationTypes } from '../../types/IstioObjects';
import { Validation } from './Validation';
import { highestSeverity } from '../../types/ServiceInfo';
import { kialiStyle } from 'styles/StyleUtils';

type ValidationListProps = {
  checks?: ObjectCheck[];
  tooltipPosition?: TooltipPosition;
};

const tooltipContentStyle = kialiStyle({
  $nest: {
    '& [class*="pf-v6-c-content"]': {
      color: 'inherit'
    }
  }
});

export const ValidationList: React.FC<ValidationListProps> = (props: ValidationListProps) => {
  const content = (
    <div className={tooltipContentStyle}>
      {(props.checks ?? []).map(check => {
        return (
          <Validation
            key={`validation-check-${check.code}-${check.path}-${check.message}`}
            severity={check.severity}
            message={`${check.code ? `${check.code} ` : ''}${check.message}`}
          />
        );
      })}
    </div>
  );

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
