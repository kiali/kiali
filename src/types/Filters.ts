import { TextInputTypes } from '@patternfly/react-core';
import { LabelFilters } from '../components/Filters/LabelFilter';

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

export const FilterTypes = {
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
  customComponent?: any;
  action: string;
  filterValues: FilterValue[];
  loader?: () => Promise<FilterValue[]>;
}

export interface FilterTypeWithFilter<T> extends FilterType {
  filter: (items: T[], filters: ActiveFiltersInfo) => T[];
}

export const FILTER_ACTION_APPEND = 'append';
export const FILTER_ACTION_UPDATE = 'update';

export interface ActiveFilter {
  category: string;
  value: string;
}

export type LabelOperation = 'and' | 'or';
export const ID_LABEL_OPERATION = 'opLabel';
export const DEFAULT_LABEL_OPERATION: LabelOperation = 'or';

export interface ActiveFiltersInfo {
  filters: ActiveFilter[];
  op: LabelOperation;
}

// labelFilter common to lists

export const LabelFilter: FilterType = {
  id: 'label',
  title: 'Label',
  placeholder: 'Filter by Label',
  filterType: FilterTypes.label,
  customComponent: LabelFilters,
  action: FILTER_ACTION_APPEND,
  filterValues: []
};
