import * as React from 'react';
import {
  CheckCircleIcon,
  ExclamationCircleIcon,
  ExclamationTriangleIcon,
  InfoCircleIcon
} from '@patternfly/react-icons';
import { ValidationTypes } from '../../types/IstioObjects';
import { Content, ContentVariants } from '@patternfly/react-core';
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
  icon: ExclamationCircleIcon,
  status: "danger",
  dataTest: 'icon-error-validation'
};

const WarningValidation: IconProps = {
  color: PFColors.Warning,
  status: "warning",
  icon: ExclamationTriangleIcon,
  dataTest: 'icon-warning-validation'
};

const InfoValidation: IconProps = {
  color: PFColors.Info,
  status: "info",
  icon: InfoCircleIcon
};

const CorrectValidation: IconProps = {
  color: PFColors.Success,
  status: "success",
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
    status: validation.status,
    icon: validation.icon,
    dataTest: validation.dataTest
  };

  if (hasMessage) {
    return (
      <div className={validationStyle}>
        <Content component={ContentVariants.p} style={textStyle}>
          {createIcon(iconProps)} {props.message}
        </Content>
      </div>
    );
  } else {
    return <>{createIcon(iconProps)}</>;
  }
};
