import { ObjectCheck, ObjectValidation, ValidationTypes } from '../types/IstioObjects';
import * as MessageCenter from './MessageCenter';

const validationMessage = (validation: ObjectValidation, failedCheck: ObjectCheck) => {
  return `${validation.objectType}:${validation.name} ${failedCheck.message}`;
};

export const showInMessageCenter = (validation: ObjectValidation) => {
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
