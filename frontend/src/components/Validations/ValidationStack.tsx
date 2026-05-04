import * as React from 'react';
import { ObjectCheck, ValidationTypes } from '../../types/IstioObjects';
import { Validation } from './Validation';
import { highestSeverity } from '../../types/ServiceInfo';
import { Stack, StackItem } from '@patternfly/react-core';
import { kialiStyle } from 'styles/StyleUtils';

type ValidationStackProps = {
  checks?: ObjectCheck[];
};

const tooltipContentStyle = kialiStyle({
  $nest: {
    '& [class*="pf-v6-c-content"]': {
      color: 'inherit'
    }
  }
});

const titleStyle = kialiStyle({
  fontWeight: 'bold'
});

export const ValidationStack: React.FC<ValidationStackProps> = (props: ValidationStackProps) => {
  const validationList = (): React.ReactNode[] => {
    return (props.checks ?? []).map((check, index) => {
      return (
        <StackItem key={`validation-check-item-${index}`}>
          <Validation
            key={`validation-check-${index}`}
            severity={check.severity}
            message={`${check.code ? `${check.code} ` : ''}${check.message}`}
          />
        </StackItem>
      );
    });
  };

  const severity = highestSeverity(props.checks ?? []);
  const isValid = severity === ValidationTypes.Correct;

  if (!isValid) {
    return (
      <Stack className={tooltipContentStyle}>
        <StackItem className={titleStyle}>Istio validations</StackItem>
        {validationList()}
      </Stack>
    );
  } else {
    return null;
  }
};
