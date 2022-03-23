import React from 'react';
import { ObjectCheck, ObjectValidation, ValidationTypes } from '../../types/IstioObjects';
import Validation from './Validation';

type Props = {
  validation?: ObjectValidation;
};

class GlobalValidation extends React.Component<Props> {
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

  severity(): ValidationTypes {
    if (!this.props.validation) {
      return ValidationTypes.Error;
    }

    const object = this.props.validation;
    const warnChecks = this.numberOfChecks(ValidationTypes.Warning);
    const errChecks = this.numberOfChecks(ValidationTypes.Error);

    let validation: ValidationTypes = ValidationTypes.Correct;
    if (!object.valid) {
      if (errChecks > 0) {
        validation = ValidationTypes.Error;
      } else if (warnChecks > 0) {
        validation = ValidationTypes.Warning;
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
    let message = checks.map(check => (check.code ? check.code + ' ' : '') + check.message).join(',');

    if (!message.length && !this.isValid()) {
      message = 'Not all checks passed!';
    }

    return message;
  }

  render() {
    return <Validation severity={this.severity()} message={this.message()} messageColor={true} />;
  }
}

export default GlobalValidation;
