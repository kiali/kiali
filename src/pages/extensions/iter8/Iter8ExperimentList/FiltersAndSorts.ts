import { FILTER_ACTION_APPEND, FilterType } from '../../../../types/Filters';
import { SortField } from '../../../../types/SortFilters';
import { Iter8Experiment } from '../../../../types/Iter8';
import { TextInputTypes } from '@patternfly/react-core';

// Place Holder, not quite finished yet. Or if filter is needed, and how to use the common filters?

export const sortFields: SortField<Iter8Experiment>[] = [
  {
    id: 'namespace',
    title: 'Namespace',
    isNumeric: false,
    param: 'ns',
    compare: (a, b) => {
      let sortValue = a.namespace.localeCompare(b.namespace);
      if (sortValue === 0) {
        sortValue = a.name.localeCompare(b.name);
      }
      return sortValue;
    }
  },
  {
    id: 'name',
    title: 'Name',
    isNumeric: false,
    param: 'wn',
    compare: (a, b) => a.name.localeCompare(b.name)
  },
  {
    id: 'phase',
    title: 'Phase',
    isNumeric: false,
    param: 'is',
    compare: (a, b) => a.name.localeCompare(b.name)
  },
  {
    id: 'baseline',
    title: 'Baseline',
    isNumeric: false,
    param: 'is',
    compare: (a, b) => a.name.localeCompare(b.name)
  },
  {
    id: 'candidate',
    title: 'Candidate',
    isNumeric: false,
    param: 'is',
    compare: (a, b) => a.name.localeCompare(b.name)
  }
];

const appNameFilter: FilterType = {
  id: 'name',
  title: 'Name',
  placeholder: 'Filter by Experiment Name',
  filterType: TextInputTypes.text,
  action: FILTER_ACTION_APPEND,
  filterValues: []
};

export const availableFilters: FilterType[] = [appNameFilter];

/** Sort Method */

export const sortAppsItems = (
  unsorted: Iter8Experiment[],
  sortField: SortField<Iter8Experiment>,
  isAscending: boolean
): Promise<Iter8Experiment[]> => {
  const sorted = unsorted.sort(isAscending ? sortField.compare : (a, b) => sortField.compare(b, a));
  return Promise.resolve(sorted);
};
