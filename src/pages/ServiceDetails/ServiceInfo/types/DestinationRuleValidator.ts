import { DestinationRule } from '../../../../types/IstioObjects';
import SubsetValidator from './SubsetValidator';

export default class DestinationRuleValidator {
  destinationRule: DestinationRule;
  unformattedField: string;

  constructor(destinationRule: DestinationRule) {
    this.destinationRule = destinationRule;
    this.unformattedField = 'none';
  }

  isValid() {
    return this.hasValidName() && this.hasSpecData() && this.hasValidSubsets() && this.hasValidHost();
  }

  hasValidName() {
    if (typeof this.destinationRule.metadata.name !== 'string') {
      this.unformattedField = 'Name';
      return false;
    }

    return true;
  }

  hasSpecData() {
    return this.destinationRule.spec !== null;
  }

  hasValidSubsets() {
    if (!this.destinationRule.spec.subsets) {
      return true;
    }

    let valid = this.destinationRule.spec.subsets instanceof Array;
    valid =
      valid && this.destinationRule.spec.subsets.every((subset, _i, _ary) => new SubsetValidator(subset).isValid());

    if (!valid) {
      this.unformattedField = 'Subsets';
    }

    return valid;
  }

  hasValidHost() {
    if (typeof this.destinationRule.spec.host !== 'string') {
      this.unformattedField = 'Host';
      return false;
    }

    return true;
  }

  formatValidation() {
    if (!this.isValid()) {
      return {
        message: 'This destination rule has format problems in field ' + this.unformattedField,
        severity: 'error',
        path: ''
      };
    }

    return null;
  }
}
