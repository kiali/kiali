export type LabelDisplayName = string;
export type PromLabel = string;

// Collection of values for a single label, associated to a show/hide flag
export type SingleLabelValues = { [key: string]: boolean };

// Map of all labels (using prometheus name), each with its set of values
export type AllPromLabelsValues = Map<PromLabel, SingleLabelValues>;

export type LabelSet = {
  [key: string]: string;
};
