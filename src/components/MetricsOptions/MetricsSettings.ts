import { PromLabel, LabelDisplayName, SingleLabelValues } from '@kiali/k-charted-pf4';

export type Quantiles = '0.5' | '0.95' | '0.99' | '0.999';
export const allQuantiles: Quantiles[] = ['0.5', '0.95', '0.99', '0.999'];

export type LabelSettings = {
  checked: boolean;
  displayName: LabelDisplayName;
  values: SingleLabelValues;
  defaultValue: boolean;
};
export type LabelsSettings = Map<PromLabel, LabelSettings>;

export interface MetricsSettings {
  labelsSettings: LabelsSettings;
  showAverage: boolean;
  showQuantiles: Quantiles[];
}
