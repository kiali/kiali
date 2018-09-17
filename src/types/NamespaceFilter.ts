import PropTypes from 'prop-types';

export interface FilterValue {
  id: string;
  title: string;
}

export interface FilterType {
  id: string;
  title: string;
  placeholder: string;
  filterType: string;
  action: string;
  filterValues: FilterValue[];
}

export const FILTER_ACTION_APPEND = 'append';
export const FILTER_ACTION_UPDATE = 'update';

export interface ActiveFilter {
  label: string;
  category: string;
  value: string;
}

export interface NamespaceFilterProps {
  onFilterChange: PropTypes.func;
  onError: PropTypes.func;
  initialFilters: FilterType[];
  initialActiveFilters?: ActiveFilter[];
}

export interface NamespaceFilterState {
  filterTypeList: FilterType[];
  currentFilterType: FilterType;
  activeFilters: ActiveFilter[];
  currentValue: string;
}
