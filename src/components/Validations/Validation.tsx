import React from 'react';
import { ErrorCircleOIcon, OkIcon, WarningTriangleIcon } from '@patternfly/react-icons';
import { PfColors } from '../Pf/PfColors';
import { IconType } from '@patternfly/react-icons/dist/js/createIcon';
import { ValidationTypes } from '../../types/IstioObjects';
import { Text, TextVariants } from '@patternfly/react-core';
import './Validation.css';

type Props = ValidationDescription & {
  messageColor?: boolean;
};

export type ValidationDescription = {
  severity: ValidationTypes;
  message?: string;
};

export type ValidationType = {
  color: string;
  icon: IconType;
};

const ErrorValidation: ValidationType = {
  color: PfColors.Red100,
  icon: ErrorCircleOIcon
};

const WarningValidation: ValidationType = {
  color: PfColors.Orange400,
  icon: WarningTriangleIcon
};

const CorrectValidation: ValidationType = {
  color: PfColors.Green400,
  icon: OkIcon
};

const severityToValidation: { [severity: string]: ValidationType } = {
  error: ErrorValidation,
  warning: WarningValidation,
  correct: CorrectValidation
};

class Validation extends React.Component<Props> {
  validation() {
    return severityToValidation[this.props.severity];
  }

  render() {
    const validation = this.validation();
    const IconComponent = validation.icon;
    const colorMessage = this.props.messageColor || false;
    const colorStyle = { color: validation.color };
    const hasMessage = this.props.message;
    if (hasMessage) {
      return (
        <div className="validation">
          <div style={{ float: 'left', margin: '2px 0.6em 0 0' }}>
            <IconComponent style={colorStyle} />
          </div>
          <Text component={TextVariants.p} style={colorMessage ? colorStyle : {}}>
            {this.props.message}
          </Text>
        </div>
      );
    } else {
      return <IconComponent style={colorStyle} />;
    }
  }
}

export default Validation;
