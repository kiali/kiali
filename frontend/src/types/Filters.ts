import { TextInputTypes } from '@patternfly/react-core';

// FilterValue maps a Patternfly property. Modify with care.
export interface FilterValue {
  id: string;
  title: string;
}

enum NonInputTypes {
  typeAhead = 'typeahead',
  select = 'select',
  label = 'label',
  nsLabel = 'nsLabel'
}

export const AllFilterTypes = {
  ...TextInputTypes,
  ...NonInputTypes
};

type FilterTypes = NonInputTypes | TextInputTypes;

// FilterType maps a Patternfly property. Modify with care.
export interface FilterType {
  id: string;
  title: string;
  placeholder: string;
  filterType: FilterTypes;
  action: string;
  filterValues: FilterValue[];
  loader?: () => Promise<FilterValue[]>;
}

export interface RunnableFilter<T> extends FilterType {
  run: (item: T, filters: ActiveFiltersInfo) => boolean;
}

export const FILTER_ACTION_APPEND = 'append';
export const FILTER_ACTION_UPDATE = 'update';

export interface ActiveFilter {
  id: string;
  title: string;
  value: string;
}

export type LabelOperation = 'and' | 'or';
export const ID_LABEL_OPERATION = 'opLabel';
export const DEFAULT_LABEL_OPERATION: LabelOperation = 'or';

export interface ActiveFiltersInfo {
  filters: ActiveFilter[];
  op: LabelOperation;
}
