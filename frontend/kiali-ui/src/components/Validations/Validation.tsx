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
import './Validation.css';
import { PFColors } from 'components/Pf/PfColors';

type Props = ValidationDescription & {
  messageColor?: boolean;
  size?: string;
  textStyle?: React.CSSProperties;
  iconStyle?: React.CSSProperties;
};

export type ValidationDescription = {
  severity: ValidationTypes;
  message?: string;
};

export type ValidationType = {
  name: string;
  color: string;
  icon: React.ComponentClass<SVGIconProps>;
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
  error: ErrorValidation,
  warning: WarningValidation,
  correct: CorrectValidation,
  info: InfoValidation
};

class Validation extends React.Component<Props> {
  validation() {
    return severityToValidation[this.props.severity];
  }

  severityColor() {
    return { color: this.validation().color };
  }

  textStyle() {
    const colorMessage = this.props.messageColor || false;
    const textStyle = this.props.textStyle || {};
    if (colorMessage) {
      Object.assign(textStyle, this.severityColor());
    }
    return textStyle;
  }

  iconStyle() {
    const iconStyle = this.props.iconStyle ? { ...this.props.iconStyle } : {};
    const defaultStyle: CSSProperties = {
      verticalAlign: '-0.125em'
    };
    Object.assign(iconStyle, this.severityColor());
    Object.assign(iconStyle, defaultStyle);
    return iconStyle;
  }

  render() {
    const validation = this.validation();
    const IconComponent = validation.icon;
    const hasMessage = !!this.props.message;
    if (hasMessage) {
      return (
        <div className="validation">
          <Text component={TextVariants.p} style={this.textStyle()}>
            <IconComponent style={this.iconStyle()} /> {this.props.message}
          </Text>
        </div>
      );
    } else {
      return <IconComponent style={this.iconStyle()} />;
    }
  }
}

export default Validation;
