import { AppsListActions } from '../actions/AppsListActions';
import { NamespacesListActions } from '../actions/NamespacesListActions';
import { ServicesListActions } from '../actions/ServicesListActions';
import { WorkloadsListActions } from '../actions/WorkloadsListActions';
import type { URLParam } from 'app/History';
import type { ManagedListPageType } from './useManagedListColumns';

// URL param values match URLParam in app/History.tsx. String literals avoid eager enum
// access at module load (routes → list pages → presets must not break History mocks).
export const applicationsListColumnsPreset = {
  actions: AppsListActions,
  columnOrderUrlParam: 'apporder' as URLParam,
  hiddenColumnsUrlParam: 'apphide' as URLParam,
  hideClusterColumnInModal: true,
  listType: 'applications' as ManagedListPageType,
  untoggleableColumnId: 'name'
};

export const servicesListColumnsPreset = {
  actions: ServicesListActions,
  columnOrderUrlParam: 'svcorder' as URLParam,
  hiddenColumnsUrlParam: 'svchide' as URLParam,
  hideClusterColumnInModal: true,
  listType: 'services' as ManagedListPageType,
  untoggleableColumnId: 'name'
};

export const workloadsListColumnsPreset = {
  actions: WorkloadsListActions,
  columnOrderUrlParam: 'wlorder' as URLParam,
  hiddenColumnsUrlParam: 'wlhide' as URLParam,
  hideClusterColumnInModal: true,
  listType: 'workloads' as ManagedListPageType,
  untoggleableColumnId: 'name'
};

export const namespacesListColumnsPreset = {
  actions: NamespacesListActions,
  columnOrderUrlParam: 'nsorder' as URLParam,
  hiddenColumnsUrlParam: 'nshide' as URLParam,
  hideClusterColumnInModal: true,
  listType: 'namespaces' as ManagedListPageType,
  untoggleableColumnId: 'namespace'
};
