import React from 'react';
import { ObjectCheck, ObjectValidation } from '../../types/IstioObjects';
import { ErrorCircleOIcon, OkIcon, WarningTriangleIcon } from '@patternfly/react-icons';
import { PfColors } from '../Pf/PfColors';
import { IconType } from '@patternfly/react-icons/dist/js/createIcon';

type Props = {
  validation?: ObjectValidation;
};

enum ValidationTypes {
  Error = 'error',
  Warning = 'warning',
  Correct = 'correct'
}

type ValidationType = {
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

class Validation extends React.Component<Props> {
  isValid(): boolean {
    return !!this.props.validation && this.props.validation.valid;
  }

  numberOfChecks(type: string): number {
    const object = this.props.validation;
    let count = 0;

    if (object) {
      count = (object && object.checks ? object.checks : []).filter(i => i.severity === type).length;
    }

    return count;
  }

  validation(): ValidationType {
    if (!this.props.validation) {
      return ErrorValidation;
    }

    const object = this.props.validation;
    const warnChecks = this.numberOfChecks(ValidationTypes.Warning);
    const errChecks = this.numberOfChecks(ValidationTypes.Error);

    let validation: ValidationType = CorrectValidation;
    if (!object.valid) {
      if (errChecks > 0) {
        validation = ErrorValidation;
      } else if (warnChecks > 0) {
        validation = WarningValidation;
      }
    }

    return validation;
  }

  checkForPath(path: string): ObjectCheck[] {
    const object = this.props.validation;

    if (!object || !object.checks) {
      return [];
    }

    const check = object.checks.filter(item => {
      return item.path === path;
    });

    return check;
  }

  globalChecks(): ObjectCheck[] {
    return this.checkForPath('');
  }

  message(): string {
    const checks = this.globalChecks();
    let message = checks.map(check => check.message).join(',');

    if (!message.length && !this.isValid()) {
      message = 'Not all checks passed!';
    }

    return message;
  }

  render() {
    const validation = this.validation();
    const ValidationIcon = validation.icon;

    return (
      <>
        <p style={{ color: validation.color }}>
          <ValidationIcon /> {this.message()}
        </p>
      </>
    );
  }
}

export default Validation;
