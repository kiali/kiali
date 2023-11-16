import React, { CSSProperties } from 'react';
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

const validationStyle = kialiStyle({
  textAlign: 'left',
  $nest: {
    '&:last-child p': {
      margin: 0
    }
  }
});

type ValidationProps = ValidationDescription & {
  iconStyle?: React.CSSProperties;
  messageColor?: boolean;
  size?: string;
  textStyle?: React.CSSProperties;
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
  const IconComponent = validation.icon;
  const severityColor = { color: validation.color };
  const hasMessage = !!props.message;

  // Set text style
  const colorMessage = props.messageColor ?? false;
  const textStyle = props.textStyle ?? {};

  if (colorMessage) {
    Object.assign(textStyle, severityColor);
  }

  // Set icon style
  const iconStyle = props.iconStyle ? { ...props.iconStyle } : {};

  const defaultStyle: CSSProperties = {
    verticalAlign: '-0.125rem'
  };

  Object.assign(iconStyle, severityColor);
  Object.assign(iconStyle, defaultStyle);

  if (hasMessage) {
    return (
      <div className={validationStyle}>
        <Text component={TextVariants.p} style={textStyle}>
          <IconComponent style={iconStyle} /> {props.message}
        </Text>
      </div>
    );
  } else {
    return <IconComponent style={iconStyle} />;
  }
};
