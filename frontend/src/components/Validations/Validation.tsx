import React from 'react';
import {
  CheckCircleIcon,
  ExclamationCircleIcon,
  ExclamationTriangleIcon,
  InfoCircleIcon
} from '@patternfly/react-icons';
import { SVGIconProps } from '@patternfly/react-icons/dist/js/createIcon';
import { ValidationTypes } from '../../types/IstioObjects';
import { Text, TextVariants } from '@patternfly/react-core';
import { PFColors } from 'components/Pf/PfColors';
import { kialiStyle } from 'styles/StyleUtils';
import { createIcon } from 'config/KialiIcon';

const validationStyle = kialiStyle({
  textAlign: 'left',
  $nest: {
    '&:last-child p': {
      margin: 0
    }
  }
});

type ValidationProps = ValidationDescription & {
  messageColor?: boolean;
  size?: string;
};

export type ValidationDescription = {
  message?: string;
  severity: ValidationTypes;
};

export type ValidationType = {
  color: string;
  icon: React.ComponentClass<SVGIconProps>;
  name: string;
};

const ErrorValidation: ValidationType = {
  name: 'Not Valid',
  color: PFColors.Danger,
  icon: ExclamationCircleIcon
};

const WarningValidation: ValidationType = {
  name: 'Warning',
  color: PFColors.Warning,
  icon: ExclamationTriangleIcon
};

const InfoValidation: ValidationType = {
  name: 'Info',
  color: PFColors.Info,
  icon: InfoCircleIcon
};

const CorrectValidation: ValidationType = {
  name: 'Valid',
  color: PFColors.Success,
  icon: CheckCircleIcon
};

export const severityToValidation: { [severity: string]: ValidationType } = {
  correct: CorrectValidation,
  error: ErrorValidation,
  info: InfoValidation,
  warning: WarningValidation
};

export const Validation: React.FC<ValidationProps> = (props: ValidationProps) => {
  const validation = severityToValidation[props.severity];
  const severityColor = { color: validation.color };
  const hasMessage = !!props.message;

  // Set icon style
  const iconStyle = kialiStyle(severityColor);

  const iconProps = {
    className: iconStyle,
    icon: validation.icon
  };

  if (hasMessage) {
    return (
      <div className={validationStyle}>
        <Text component={TextVariants.p} style={severityColor}>
          {createIcon(iconProps)} {props.message}
        </Text>
      </div>
    );
  } else {
    return <>{createIcon(iconProps)}</>;
  }
};
