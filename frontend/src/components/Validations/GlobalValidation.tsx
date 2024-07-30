import * as React from 'react';
import { ObjectCheck, ObjectValidation, ValidationTypes } from '../../types/IstioObjects';
import { Validation } from './Validation';

type GlobalValidationProps = {
  validation?: ObjectValidation;
};

export const GlobalValidation: React.FC<GlobalValidationProps> = (props: GlobalValidationProps) => {
  const isValid = (): boolean => {
    return !!props.validation && props.validation.valid;
  };

  const numberOfChecks = (type: string): number => {
    const object = props.validation;
    let count = 0;

    if (object) {
      count = (object && object.checks ? object.checks : []).filter(i => i.severity === type).length;
    }

    return count;
  };

  const severity = (): ValidationTypes => {
    if (!props.validation) {
      return ValidationTypes.Error;
    }

    const object = props.validation;
    const warnChecks = numberOfChecks(ValidationTypes.Warning);
    const errChecks = numberOfChecks(ValidationTypes.Error);

    let validation: ValidationTypes = ValidationTypes.Correct;

    if (!object.valid) {
      if (errChecks > 0) {
        validation = ValidationTypes.Error;
      } else if (warnChecks > 0) {
        validation = ValidationTypes.Warning;
      }
    }

    return validation;
  };

  const checkForPath = (path: string): ObjectCheck[] => {
    const object = props.validation;

    if (!object || !object.checks) {
      return [];
    }

    const check = object.checks.filter(item => {
      return item.path === path;
    });

    return check;
  };

  const globalChecks = (): ObjectCheck[] => {
    return checkForPath('');
  };

  const message = (): string => {
    const checks = globalChecks();
    let message = checks.map(check => (check.code ? `${check.code} ` : '') + check.message).join(',');

    if (!message.length && !isValid()) {
      message = 'Not all checks passed!';
    }

    return message;
  };

  return <Validation severity={severity()} message={message()} messageColor={true} />;
};
