import React from 'react';
import {
  CheckCircleIcon,
  ExclamationCircleIcon,
  ExclamationTriangleIcon,
  InfoCircleIcon
} from '@patternfly/react-icons';
import { ValidationTypes } from '../../types/IstioObjects';
import { Text, TextVariants } from '@patternfly/react-core';
import { PFColors } from 'components/Pf/PfColors';
import { kialiStyle } from 'styles/StyleUtils';
import { IconProps, createIcon } from 'config/KialiIcon';

const validationStyle = kialiStyle({
  textAlign: 'left',
  $nest: {
    '&:last-child p': {
      margin: 0
    }
  }
});

type ValidationProps = {
  message?: string;
  messageColor?: boolean;
  severity: ValidationTypes;
};

const ErrorValidation: IconProps = {
  color: PFColors.Danger,
  icon: ExclamationCircleIcon
};

const WarningValidation: IconProps = {
  color: PFColors.Warning,
  icon: ExclamationTriangleIcon
};

const InfoValidation: IconProps = {
  color: PFColors.Info,
  icon: InfoCircleIcon
};

const CorrectValidation: IconProps = {
  color: PFColors.Success,
  icon: CheckCircleIcon,
  dataTest: 'icon-correct-validation'
};

const severityToValidation: { [severity: string]: IconProps } = {
  correct: CorrectValidation,
  error: ErrorValidation,
  info: InfoValidation,
  warning: WarningValidation
};

export const Validation: React.FC<ValidationProps> = (props: ValidationProps) => {
  const validation = severityToValidation[props.severity];
  const severityColor = { color: validation.color };
  const hasMessage = !!props.message;

  // Set styles
  const textStyle = props.messageColor ? severityColor : {};
  const iconStyle = kialiStyle(severityColor);

  const iconProps: IconProps = {
    className: iconStyle,
    icon: validation.icon,
    dataTest: validation.dataTest
  };

  if (hasMessage) {
    return (
      <div className={validationStyle}>
        <Text component={TextVariants.p} style={textStyle}>
          {createIcon(iconProps)} {props.message}
        </Text>
      </div>
    );
  } else {
    return <>{createIcon(iconProps)}</>;
  }
};
