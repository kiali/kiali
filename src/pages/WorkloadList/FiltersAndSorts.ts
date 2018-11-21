import { ActiveFilter, FILTER_ACTION_APPEND, FILTER_ACTION_UPDATE, FilterType } from '../../types/Filters';
import { WorkloadListItem, WorkloadType } from '../../types/Workload';
import { SortField } from '../../types/SortFilters';
import { getRequestErrorsStatus, WorkloadHealth } from '../../types/Health';
import NamespaceFilter from '../../components/Filters/NamespaceFilter';
import {
  presenceValues,
  istioSidecarFilter,
  healthFilter,
  getFilterSelectedValues,
  getPresenceFilterValue,
  filterByHealth
} from '../../components/Filters/CommonFilters';

type WorkloadItemHealth = WorkloadListItem & { health: WorkloadHealth };

export namespace WorkloadListFilters {
  export const sortFields: SortField<WorkloadListItem>[] = [
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
          const ratioA = getRequestErrorsStatus(a.health.requests.errorRatio).value;
          const ratioB = getRequestErrorsStatus(b.health.requests.errorRatio).value;
          return ratioA === ratioB ? a.workload.name.localeCompare(b.workload.name) : ratioA - ratioB;
        }
        return 0;
      }
    }
  ];

  const workloadNameFilter: FilterType = {
    id: 'workloadname',
    title: 'Workload Name',
    placeholder: 'Filter by Workload Name',
    filterType: 'text',
    action: FILTER_ACTION_APPEND,
    filterValues: []
  };

  const appLabelFilter: FilterType = {
    id: 'applabel',
    title: 'App Label',
    placeholder: 'Filter by App Label Validation',
    filterType: 'select',
    action: FILTER_ACTION_UPDATE,
    filterValues: presenceValues
  };

  const versionLabelFilter: FilterType = {
    id: 'versionlabel',
    title: 'Version Label',
    placeholder: 'Filter by Version Label Validation',
    filterType: 'select',
    action: FILTER_ACTION_UPDATE,
    filterValues: presenceValues
  };

  const workloadTypeFilter: FilterType = {
    id: 'workloadtype',
    title: 'Workload Type',
    placeholder: 'Filter by Workload Type',
    filterType: 'select',
    action: FILTER_ACTION_APPEND,
    filterValues: [
      {
        id: WorkloadType.CronJob,
        title: WorkloadType.CronJob
      },
      {
        id: WorkloadType.DaemonSet,
        title: WorkloadType.DaemonSet
      },
      {
        id: WorkloadType.Deployment,
        title: WorkloadType.Deployment
      },
      {
        id: WorkloadType.DeploymentConfig,
        title: WorkloadType.DeploymentConfig
      },
      {
        id: WorkloadType.Job,
        title: WorkloadType.Job
      },
      {
        id: WorkloadType.Pod,
        title: WorkloadType.Pod
      },
      {
        id: WorkloadType.ReplicaSet,
        title: WorkloadType.ReplicaSet
      },
      {
        id: WorkloadType.ReplicationController,
        title: WorkloadType.ReplicationController
      },
      {
        id: WorkloadType.StatefulSet,
        title: WorkloadType.StatefulSet
      }
    ]
  };

  export const availableFilters: FilterType[] = [
    NamespaceFilter.create(),
    workloadNameFilter,
    workloadTypeFilter,
    istioSidecarFilter,
    healthFilter,
    appLabelFilter,
    versionLabelFilter
  ];
  export const namespaceFilter = availableFilters[0];

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
    if (filter && filter.length === 0) {
      return items;
    }
    return items.filter(item => includeName(item.workload.type, filter));
  };

  const filterByLabel = (
    items: WorkloadListItem[],
    istioSidecar: boolean | undefined,
    app: boolean | undefined,
    version: boolean | undefined
  ): WorkloadListItem[] => {
    let result = items;
    if (istioSidecar !== undefined) {
      result = result.filter(item => item.workload.istioSidecar === istioSidecar);
    }
    if (app !== undefined) {
      result = result.filter(item => item.workload.appLabel === app);
    }
    if (version !== undefined) {
      result = result.filter(item => item.workload.versionLabel === version);
    }
    return result;
  };

  const filterByName = (items: WorkloadListItem[], names: string[]): WorkloadListItem[] => {
    if (names.length === 0) {
      return items;
    }
    return items.filter(item => names.some(name => item.workload.name.includes(name)));
  };

  export const filterBy = (
    items: WorkloadListItem[],
    filters: ActiveFilter[]
  ): Promise<WorkloadListItem[]> | WorkloadListItem[] => {
    const workloadTypeFilters = getFilterSelectedValues(workloadTypeFilter, filters);
    const workloadNamesSelected = getFilterSelectedValues(workloadNameFilter, filters);
    const istioSidecar = getPresenceFilterValue(istioSidecarFilter, filters);
    const appLabel = getPresenceFilterValue(appLabelFilter, filters);
    const versionLabel = getPresenceFilterValue(versionLabelFilter, filters);

    let ret = items;
    ret = filterByType(ret, workloadTypeFilters);
    ret = filterByName(ret, workloadNamesSelected);
    ret = filterByLabel(ret, istioSidecar, appLabel, versionLabel);

    // We may have to perform a second round of filtering, using data fetched asynchronously (health)
    // If not, exit fast
    const healthSelected = getFilterSelectedValues(healthFilter, filters);
    if (healthSelected.length > 0) {
      return filterByHealth(ret, healthSelected);
    }
    return ret;
  };

  /** Sort Method */

  export const sortWorkloadsItems = (
    unsorted: WorkloadListItem[],
    sortField: SortField<WorkloadListItem>,
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
