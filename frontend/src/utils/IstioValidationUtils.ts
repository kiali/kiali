import { ObjectCheck, ObjectValidation, ValidationTypes } from '../types/IstioObjects';
import { addDanger, addWarning } from './AlertUtils';
import { getGVKTypeString } from './IstioConfigUtils';

const validationMessage = (validation: ObjectValidation, failedCheck: ObjectCheck): string => {
  return `${getGVKTypeString(validation.objectGVK)}:${validation.name} ${failedCheck.message}`;
};

const showInNotificationCenterValidation = (validation: ObjectValidation): void => {
  for (let check of validation.checks) {
    switch (check.severity) {
      case ValidationTypes.Warning:
        addWarning(validationMessage(validation, check), '', false);
        break;
      case ValidationTypes.Error:
        addDanger(validationMessage(validation, check));
        break;
    }
  }
};

const showInNotificationCenterValidations = (validations: ObjectValidation[]): void => {
  const elementsWithFailedValidations: string[] = [];
  let hasError = false;
  for (let validation of validations) {
    for (let check of validation.checks) {
      if ([ValidationTypes.Warning, ValidationTypes.Error].includes(check.severity)) {
        if (check.severity === ValidationTypes.Error) {
          hasError = true;
        }
        elementsWithFailedValidations.push(`${getGVKTypeString(validation.objectGVK)}:${validation.name}`);
      }
    }
  }
  if (elementsWithFailedValidations.length > 0) {
    const detail = `${elementsWithFailedValidations.join('\n')}`;
    if (hasError) {
      addDanger('IstioConfig has errors', detail);
    } else {
      addWarning('IstioConfig has warnings', detail, false);
    }
  }
};

export const showInNotificationCenter = (validation: ObjectValidation | ObjectValidation[]): void => {
  if (Array.isArray(validation)) {
    showInNotificationCenterValidations(validation);
  } else {
    showInNotificationCenterValidation(validation);
  }
};
