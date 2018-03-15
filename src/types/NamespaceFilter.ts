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
  filterValues: FilterValue[];
}

export interface ActiveFilter {
  label: string;
  category: string;
  value: string;
}

export interface NamespaceFilterProps {
  onFilterChange: PropTypes.func;
  onError: PropTypes.func;
  initialFilters: FilterType[];
}

export interface NamespaceFilterState {
  filterTypeList: FilterType[];
  currentFilterType: FilterType;
  activeFilters: ActiveFilter[];
  currentValue: string;
}
