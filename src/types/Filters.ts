// FilterValue maps a Patternfly property. Modify with care.
export interface FilterValue {
  id: string;
  title: string;
}

export const presenceValues: FilterValue[] = [
  {
    id: 'present',
    title: 'Present'
  },
  {
    id: 'notpresent',
    title: 'Not Present'
  }
];

// FilterType maps a Patternfly property. Modify with care.
export interface FilterType {
  id: string;
  title: string;
  placeholder: string;
  filterType: string;
  action: string;
  filterValues: FilterValue[];
  loader?: () => Promise<FilterValue[]>;
}

export const FILTER_ACTION_APPEND = 'append';
export const FILTER_ACTION_UPDATE = 'update';

export interface ActiveFilter {
  category: string;
  value: string;
}
