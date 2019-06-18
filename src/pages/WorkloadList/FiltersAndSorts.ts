import { ActiveFilter, FILTER_ACTION_APPEND, FILTER_ACTION_UPDATE, FilterType } from '../../types/Filters';
import { WorkloadListItem, WorkloadType } from '../../types/Workload';
import { GenericSortField, HealthSortField } from '../../types/SortFilters';
import { getRequestErrorsStatus, WithWorkloadHealth } from '../../types/Health';
import {
  presenceValues,
  istioSidecarFilter,
  healthFilter,
  getFilterSelectedValues,
  getPresenceFilterValue,
  filterByHealth
} from '../../components/Filters/CommonFilters';

export const sortFields: GenericSortField<WorkloadListItem>[] = [
  {
    id: 'namespace',
    title: 'Namespace',
    isNumeric: false,
    param: 'ns',
    compare: (a, b) => {
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
    compare: (a, b) => a.workload.name.localeCompare(b.workload.name)
  },
  {
    id: 'workloadtype',
    title: 'Workload Type',
    isNumeric: false,
    param: 'wt',
    compare: (a, b) => a.workload.type.localeCompare(b.workload.type)
  },
  {
    id: 'istiosidecar',
    title: 'IstioSidecar',
    isNumeric: false,
    param: 'is',
    compare: (a, b) => {
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
    compare: (a, b) => {
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
    compare: (a, b) => {
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
    id: 'health',
    title: 'Health',
    isNumeric: false,
    param: 'he',
    compare: (a: WithWorkloadHealth<WorkloadListItem>, b: WithWorkloadHealth<WorkloadListItem>) => {
      const statusForA = a.health.getGlobalStatus();
      const statusForB = b.health.getGlobalStatus();

      if (statusForA.priority === statusForB.priority) {
        // If both workloads have same health status, use error rate to determine order.
        const ratioA = getRequestErrorsStatus(a.health.requests.errorRatio).value;
        const ratioB = getRequestErrorsStatus(b.health.requests.errorRatio).value;
        return ratioA === ratioB ? a.workload.name.localeCompare(b.workload.name) : ratioB - ratioA;
      }

      return statusForB.priority - statusForA.priority;
    }
  } as HealthSortField<WorkloadListItem>
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
  workloadNameFilter,
  workloadTypeFilter,
  istioSidecarFilter,
  healthFilter,
  appLabelFilter,
  versionLabelFilter
];

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
  sortField: GenericSortField<WorkloadListItem>,
  isAscending: boolean
): Promise<WorkloadListItem[]> => {
  if (sortField.title === 'Health') {
    // In the case of health sorting, we may not have all health promises ready yet
    // So we need to get them all before actually sorting
    const allHealthPromises: Promise<WithWorkloadHealth<WorkloadListItem>>[] = unsorted.map(item => {
      return item.healthPromise.then((health): WithWorkloadHealth<WorkloadListItem> => ({ ...item, health }));
    });
    return Promise.all(allHealthPromises).then(arr => {
      return arr.sort(isAscending ? sortField.compare : (a, b) => sortField.compare(b, a));
    });
  }
  const sorted = unsorted.sort(isAscending ? sortField.compare : (a, b) => sortField.compare(b, a));
  return Promise.resolve(sorted);
};
