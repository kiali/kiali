import React from 'react';
import { ErrorCircleOIcon, CheckCircleIcon, WarningTriangleIcon } from '@patternfly/react-icons';
import { PfColors } from '../Pf/PfColors';
import { IconType } from '@patternfly/react-icons/dist/js/createIcon';
import { ValidationTypes } from '../../types/IstioObjects';
import { Text, TextVariants } from '@patternfly/react-core';
import './Validation.css';

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
  icon: IconType;
};

const ErrorValidation: ValidationType = {
  name: 'Not Valid',
  color: PfColors.Red100,
  icon: ErrorCircleOIcon
};

const WarningValidation: ValidationType = {
  name: 'Warning',
  color: PfColors.Orange400,
  icon: WarningTriangleIcon
};

const CorrectValidation: ValidationType = {
  name: 'Valid',
  color: PfColors.LightGreen400,
  icon: CheckCircleIcon
};

export const severityToValidation: { [severity: string]: ValidationType } = {
  error: ErrorValidation,
  warning: WarningValidation,
  correct: CorrectValidation
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
    const iconStyle = this.props.iconStyle || {};
    Object.assign(iconStyle, this.severityColor());
    return iconStyle;
  }

  render() {
    const validation = this.validation();
    const IconComponent = validation.icon;
    const hasMessage = !!this.props.message;
    if (hasMessage) {
      return (
        <div className="validation">
          <div style={{ float: 'left', margin: '2px 0.6em 0 0' }}>
            <IconComponent style={this.iconStyle()} />
          </div>
          <Text component={TextVariants.p} style={this.textStyle()}>
            {this.props.message}
          </Text>
        </div>
      );
    } else {
      return <IconComponent style={this.severityColor()} />;
    }
  }
}

export default Validation;
