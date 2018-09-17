import {
  ActiveFilter,
  FILTER_ACTION_APPEND,
  FILTER_ACTION_UPDATE,
  FilterType,
  FilterValue
} from '../../types/NamespaceFilter';
import { WorkloadListItem, WorkloadType } from '../../types/Workload';
import { removeDuplicatesArray } from '../../utils/Common';
import { getRequestErrorsRatio, WorkloadHealth } from '../../types/Health';

type WorkloadItemHealth = WorkloadListItem & { health: WorkloadHealth };

export namespace WorkloadListFilters {
  export interface SortField {
    id: string;
    title: string;
    isNumeric: boolean;
    param: string;
    compare: (a: WorkloadListItem, b: WorkloadListItem) => number;
  }

  export const sortFields: SortField[] = [
    {
      id: 'namespace',
      title: 'Namespace',
      isNumeric: false,
      param: 'ns',
      compare: (a: WorkloadListItem, b: WorkloadListItem) => {
        let sortValue = a.namespace.localeCompare(b.namespace);
        if (sortValue === 0) {
          sortValue = a.workload.name.localeCompare(b.workload.name);
        }
        return sortValue;
      }
    },
    {
      id: 'workloadname',
      title: 'Workload Name',
      isNumeric: false,
      param: 'wn',
      compare: (a: WorkloadListItem, b: WorkloadListItem) => a.workload.name.localeCompare(b.workload.name)
    },
    {
      id: 'workloadtype',
      title: 'Workload Type',
      isNumeric: false,
      param: 'wt',
      compare: (a: WorkloadListItem, b: WorkloadListItem) => a.workload.type.localeCompare(b.workload.type)
    },
    {
      id: 'istiosidecar',
      title: 'IstioSidecar',
      isNumeric: false,
      param: 'is',
      compare: (a: WorkloadListItem, b: WorkloadListItem) => {
        if (a.workload.istioSidecar && !b.workload.istioSidecar) {
          return -1;
        } else if (!a.workload.istioSidecar && b.workload.istioSidecar) {
          return 1;
        } else {
          return a.workload.name.localeCompare(b.workload.name);
        }
      }
    },
    {
      id: 'applabel',
      title: 'App Label',
      isNumeric: false,
      param: 'al',
      compare: (a: WorkloadListItem, b: WorkloadListItem) => {
        if (a.workload.appLabel && !b.workload.appLabel) {
          return -1;
        } else if (!a.workload.appLabel && b.workload.appLabel) {
          return 1;
        } else {
          return a.workload.name.localeCompare(b.workload.name);
        }
      }
    },
    {
      id: 'versionlabel',
      title: 'Version Label',
      isNumeric: false,
      param: 'vl',
      compare: (a: WorkloadListItem, b: WorkloadListItem) => {
        if (a.workload.versionLabel && !b.workload.versionLabel) {
          return -1;
        } else if (!a.workload.versionLabel && b.workload.versionLabel) {
          return 1;
        } else {
          return a.workload.name.localeCompare(b.workload.name);
        }
      }
    },
    {
      id: 'errorrate',
      title: 'Error Rate',
      isNumeric: true,
      param: 'er',
      compare: (a: WorkloadItemHealth, b: WorkloadItemHealth) => {
        if (a.health && b.health) {
          const ratioA = getRequestErrorsRatio(a.health.requests).value;
          const ratioB = getRequestErrorsRatio(b.health.requests).value;
          return ratioA === ratioB ? a.workload.name.localeCompare(b.workload.name) : ratioA - ratioB;
        }
        return 0;
      }
    }
  ];

  const presenceValues: FilterValue[] = [
    {
      id: 'present',
      title: 'Present'
    },
    {
      id: 'notpresent',
      title: 'Not Present'
    }
  ];

  export const workloadNameFilter: FilterType = {
    id: 'workloadname',
    title: 'Workload Name',
    placeholder: 'Filter by Workload Name',
    filterType: 'text',
    action: FILTER_ACTION_APPEND,
    filterValues: []
  };

  export const istioSidecarFilter: FilterType = {
    id: 'istio',
    title: 'Istio Sidecar',
    placeholder: 'Filter by IstioSidecar Validation',
    filterType: 'select',
    action: FILTER_ACTION_UPDATE,
    filterValues: presenceValues
  };

  export const appLabelFilter: FilterType = {
    id: 'applabel',
    title: 'App Label',
    placeholder: 'Filter by App Label Validation',
    filterType: 'select',
    action: FILTER_ACTION_UPDATE,
    filterValues: presenceValues
  };

  export const versionLabelFilter: FilterType = {
    id: 'versionlabel',
    title: 'Version Label',
    placeholder: 'Filter by Version Label Validation',
    filterType: 'select',
    action: FILTER_ACTION_UPDATE,
    filterValues: presenceValues
  };

  export const workloadTypeFilter: FilterType = {
    id: 'workloadtype',
    title: 'Workload Type',
    placeholder: 'Filter by Workload Type',
    filterType: 'select',
    action: FILTER_ACTION_APPEND,
    filterValues: [
      {
        id: WorkloadType.Deployment,
        title: WorkloadType.Deployment
      }
    ]
  };

  /** Filter Method */
  const includeName = (name: string, names: string[]) => {
    for (let i = 0; i < names.length; i++) {
      if (name.includes(names[i])) {
        return true;
      }
    }
    return false;
  };

  const filterByType = (items: WorkloadListItem[], filter: string[]): WorkloadListItem[] => {
    // let results: WorkloadItem[] = [];
    if (filter && filter.length === 0) {
      return items;
    }
    return items.filter(workload => includeName(workload.workload.type, filter));
  };

  const filterByLabel = (
    items: WorkloadListItem[],
    istioSidecar: boolean | undefined,
    app: boolean | undefined,
    version: boolean | undefined
  ): WorkloadListItem[] => {
    let result = items;
    if (istioSidecar !== undefined) {
      result = result.filter(workload => workload.workload.istioSidecar === istioSidecar);
    }

    if (app !== undefined) {
      result = result.filter(workload => workload.workload.appLabel === app);
    }
    if (version !== undefined) {
      result = result.filter(workload => workload.workload.versionLabel === version);
    }
    return result;
  };

  const filterByName = (items: WorkloadListItem[], names: string[]): WorkloadListItem[] => {
    let result = items;
    result = result.filter(item => {
      let serviceNameFiltered = true;
      if (names.length > 0) {
        serviceNameFiltered = false;
        for (let i = 0; i < names.length; i++) {
          if (item.workload.name.includes(names[i])) {
            serviceNameFiltered = true;
            break;
          }
        }
      }
      return serviceNameFiltered;
    });
    return result;
  };

  export const filterBy = (items: WorkloadListItem[], filters: ActiveFilter[]) => {
    let workloadTypeFilters: string[] = removeDuplicatesArray(
      filters
        .filter(activeFilter => activeFilter.category === 'Workload Type')
        .map(activeFilter => WorkloadType[activeFilter.value])
    );

    let results = filterByType(items, workloadTypeFilters);
    /** Get WorkloadName filter */
    let workloadNamesSelected: string[] = filters
      .filter(activeFilter => activeFilter.category === 'Workload Name')
      .map(activeFilter => activeFilter.value);

    /** Remove duplicates  */
    workloadNamesSelected = removeDuplicatesArray(workloadNamesSelected);

    /** Get IstioSidecar filter */
    let istioSidecarValidationFilters: ActiveFilter[] = filters.filter(
      activeFilter => activeFilter.category === 'Istio Sidecar'
    );
    let istioSidecar: boolean | undefined = undefined;

    if (istioSidecarValidationFilters.length > 0) {
      istioSidecar = istioSidecarValidationFilters[0].value === 'Present' ? true : false;
    }

    /** Get Label app filter */
    let appLabelFilters: ActiveFilter[] = filters.filter(activeFilter => activeFilter.category === 'App Label');
    let appLabel: boolean | undefined = undefined;

    if (appLabelFilters.length > 0) {
      appLabel = appLabelFilters[0].value === 'Present' ? true : false;
    }

    /** Get Label version filter */
    let versionLabelFilters: ActiveFilter[] = filters.filter(activeFilter => activeFilter.category === 'Version Label');
    let versionLabel: boolean | undefined = undefined;

    if (versionLabelFilters.length > 0) {
      versionLabel = versionLabelFilters[0].value === 'Present' ? true : false;
    }

    results = filterByName(results, workloadNamesSelected);
    results = filterByLabel(results, istioSidecar, appLabel, versionLabel);

    return results;
  };

  /** Sort Method */

  export const sortWorkloadsItems = (
    unsorted: WorkloadListItem[],
    sortField: WorkloadListFilters.SortField,
    isAscending: boolean
  ): Promise<WorkloadListItem[]> => {
    if (sortField.title === 'Error Rate') {
      // In the case of error rate sorting, we may not have all health promises ready yet
      // So we need to get them all before actually sorting
      const allHealthPromises: Promise<WorkloadItemHealth>[] = unsorted.map(item => {
        return item.healthPromise.then(health => {
          const withHealth: any = item;
          withHealth.health = health;
          return withHealth;
        });
      });
      return Promise.all(allHealthPromises).then(arr => {
        return arr.sort(isAscending ? sortField.compare : (a, b) => sortField.compare(b, a));
      });
    }
    const sorted = unsorted.sort(isAscending ? sortField.compare : (a, b) => sortField.compare(b, a));
    return Promise.resolve(sorted);
  };
}
