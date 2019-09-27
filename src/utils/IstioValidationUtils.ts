import { ObjectCheck, ObjectValidation, ValidationTypes } from '../types/IstioObjects';
import * as MessageCenter from './MessageCenter';

const validationMessage = (validation: ObjectValidation, failedCheck: ObjectCheck) => {
  return `${validation.objectType}:${validation.name} ${failedCheck.message}`;
};

const showInMessageCenterValidation = (validation: ObjectValidation) => {
  for (let check of validation.checks) {
    switch (check.severity) {
      case ValidationTypes.Warning:
        MessageCenter.addWarning(validationMessage(validation, check));
        break;
      case ValidationTypes.Error:
        MessageCenter.addError(validationMessage(validation, check));
        break;
    }
  }
};

const showInMessageCenterValidations = (validations: ObjectValidation[]) => {
  const elementsWithFailedValidations: string[] = [];
  let hasError = false;
  for (let validation of validations) {
    for (let check of validation.checks) {
      if ([ValidationTypes.Warning, ValidationTypes.Error].includes(check.severity)) {
        if (check.severity === ValidationTypes.Error) {
          hasError = true;
        }
        elementsWithFailedValidations.push(`${validation.objectType}:${validation.name}`);
      }
    }
  }
  if (elementsWithFailedValidations.length > 0) {
    const messageCenterMethod = hasError ? MessageCenter.addError : MessageCenter.addWarning;
    messageCenterMethod(`Some IstioConfigs (${elementsWithFailedValidations.join(', ')}) have warnings or errors`);
  }
};

export const showInMessageCenter = (validation: ObjectValidation | ObjectValidation[]) => {
  if (Array.isArray(validation)) {
    showInMessageCenterValidations(validation);
  } else {
    showInMessageCenterValidation(validation);
  }
};
