import { ActiveFiltersInfo, FILTER_ACTION_APPEND, FilterType, FilterTypes } from '../../../../types/Filters';
import { SortField } from '../../../../types/SortFilters';
import { Iter8Experiment } from '../../../../types/Iter8';
import { TextInputTypes } from '@patternfly/react-core';
import { getFilterSelectedValues } from '../../../../components/Filters/CommonFilters';

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

const filterByTargetService = (items: Iter8Experiment[], names: string[]): Iter8Experiment[] => {
  return items.filter(item => {
    let targetServiceFiltered = true;
    if (names.length > 0) {
      targetServiceFiltered = false;
      for (let i = 0; i < names.length; i++) {
        if (item.targetService.includes(names[i])) {
          targetServiceFiltered = true;
          break;
        }
      }
    }
    return targetServiceFiltered;
  });
};

const filterByBaseline = (items: Iter8Experiment[], names: string[]): Iter8Experiment[] => {
  return items.filter(item => {
    let baselineFiltered = true;
    if (names.length > 0) {
      baselineFiltered = false;
      for (let i = 0; i < names.length; i++) {
        if (item.baseline.name.includes(names[i])) {
          baselineFiltered = true;
          break;
        }
      }
    }
    return baselineFiltered;
  });
};

const filterByPhase = (items: Iter8Experiment[], names: string[]): Iter8Experiment[] => {
  return items.filter(item => {
    let phaseFiltered = true;
    if (names.length > 0) {
      phaseFiltered = false;
      for (let i = 0; i < names.length; i++) {
        if (item.phase.includes(names[i])) {
          phaseFiltered = true;
          break;
        }
      }
    }
    return phaseFiltered;
  });
};

export const filterBy = (iter8Experiment: Iter8Experiment[], filters: ActiveFiltersInfo): Iter8Experiment[] => {
  let ret = iter8Experiment;

  const targetServiceSelected = getFilterSelectedValues(targetServiceFilter, filters);
  if (targetServiceSelected.length > 0) {
    ret = filterByTargetService(ret, targetServiceSelected);
  }

  const baselineSelected = getFilterSelectedValues(baselineFilter, filters);
  if (baselineSelected.length > 0) {
    ret = filterByBaseline(ret, baselineSelected);
  }

  const phaseSelected = getFilterSelectedValues(phaseFilter, filters);
  if (phaseSelected.length > 0) {
    return filterByPhase(ret, phaseSelected);
  }
  return ret;
};

const targetServiceFilter: FilterType = {
  id: 'targetService',
  title: 'Service',
  placeholder: 'Filter by Service Name',
  filterType: TextInputTypes.text,
  action: FILTER_ACTION_APPEND,
  filterValues: []
};

const baselineFilter: FilterType = {
  id: 'baselin',
  title: 'Baseline',
  placeholder: 'Filter by Baseline Name',
  filterType: TextInputTypes.text,
  action: FILTER_ACTION_APPEND,
  filterValues: []
};
const candidateFilter: FilterType = {
  id: 'candidate',
  title: 'Candidate',
  placeholder: 'Filter by Candidate Name',
  filterType: TextInputTypes.text,
  action: FILTER_ACTION_APPEND,
  filterValues: []
};

export const phaseFilter: FilterType = {
  id: 'phase',
  title: 'Phase',
  placeholder: 'Filter by Phase',
  filterType: FilterTypes.select,
  action: FILTER_ACTION_APPEND,
  filterValues: [
    {
      id: 'Initializing',
      title: 'Initializing'
    },
    {
      id: 'Progressing',
      title: 'Progressing'
    },
    {
      id: 'Pause',
      title: 'Pause'
    },
    {
      id: 'Completed',
      title: 'Completed'
    }
  ]
};
export const availableFilters: FilterType[] = [targetServiceFilter, baselineFilter, candidateFilter, phaseFilter];

/** Sort Method */

export const sortAppsItems = (
  unsorted: Iter8Experiment[],
  sortField: SortField<Iter8Experiment>,
  isAscending: boolean
): Promise<Iter8Experiment[]> => {
  const sorted = unsorted.sort(isAscending ? sortField.compare : (a, b) => sortField.compare(b, a));
  return Promise.resolve(sorted);
};
