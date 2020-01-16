import { TextInputTypes } from '@patternfly/react-core';

// FilterValue maps a Patternfly property. Modify with care.
export interface FilterValue {
  id: string;
  title: string;
}

enum NonInputTypes {
  typeAhead = 'typeahead',
  select = 'select'
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
  action: string;
  filterValues: FilterValue[];
  loader?: () => Promise<FilterValue[]>;
}

export interface FilterTypeWithFilter<T> extends FilterType {
  filter: (items: T[], filters: ActiveFilter[]) => T[];
}

export const FILTER_ACTION_APPEND = 'append';
export const FILTER_ACTION_UPDATE = 'update';

export interface ActiveFilter {
  category: string;
  value: string;
}
