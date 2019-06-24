import { Subset } from '../../../../types/IstioObjects';

export default class SubsetValidator {
  subset: Subset;

  constructor(subset: Subset) {
    this.subset = subset;
  }

  public isValid() {
    return this.hasValidName() && this.hasValidLabels();
  }

  hasValidName() {
    return this.hasStringType(this.subset.name);
  }

  hasValidLabels() {
    const valid = Object.keys(this.subset.labels).every((k, _i) => this.hasValidLabel(k, this.subset.labels[k]));
    return this.subset.labels instanceof Object && valid;
  }

  hasValidLabel(name: string, value: string): boolean {
    return this.hasStringType(name) && this.hasStringType(value);
  }

  hasStringType(value: any) {
    return typeof value === 'string';
  }
}
