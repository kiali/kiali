import { useCallback, useMemo } from 'react';
import type { ColumnManagementModalColumn } from '@patternfly/react-component-groups';
import { HistoryManager, URLParam } from 'app/History';
import { AppsListActions } from '../actions/AppsListActions';
import { NamespacesListActions } from '../actions/NamespacesListActions';
import { ServicesListActions } from '../actions/ServicesListActions';
import { WorkloadsListActions } from '../actions/WorkloadsListActions';
import { config as virtualListConfig } from '../components/VirtualList/Config';
import type { ManagedColumn } from '../components/VirtualList/ManagedColumnTypes';
import { isMultiCluster } from '../config';
import type { KialiAppAction } from '../actions/KialiAppAction';
import type { KialiDispatch } from '../types/Redux';
import { arrayEquals } from '../utils/Common';

export type ManagedListColumnActions = {
  setColumnOrder: (order: string[]) => KialiAppAction;
  setHiddenColumns: (hidden: string[]) => KialiAppAction;
};

export type ManagedListPageType = 'applications' | 'namespaces' | 'services' | 'workloads';

export type ManagedListColumnsConfig = {
  actions: ManagedListColumnActions;
  columnOrder: string[];
  columnOrderUrlParam: URLParam;
  dispatch: KialiDispatch;
  hiddenColumnIds: string[];
  hiddenColumnsUrlParam: URLParam;
  hideClusterColumnInModal?: boolean;
  listType: ManagedListPageType;
  untoggleableColumnId: string;
};

export type UseManagedListColumnsResult = {
  appliedColumns: ColumnManagementModalColumn[];
  applyColumns: (newColumns: ColumnManagementModalColumn[]) => void;
  resetColumnsToDefault: () => void;
  syncColumnsFromURL: () => void;
};

const getDefaultManagedColumns = (listType: ManagedListPageType, untoggleableColumnId: string): ManagedColumn[] => {
  return virtualListConfig[listType].columns
    .filter(c => c.title && c.title.trim().length > 0)
    .map(c => {
      const id = (c.id ?? c.name.toLowerCase()).toLowerCase();
      return {
        id,
        isDisabled: id === untoggleableColumnId,
        isShown: true,
        title: c.title
      };
    });
};

const getManagedColumns = (
  listType: ManagedListPageType,
  untoggleableColumnId: string,
  columnOrder: string[],
  hiddenColumnIds: string[]
): ManagedColumn[] => {
  const defaultCols = getDefaultManagedColumns(listType, untoggleableColumnId);
  const hiddenSet = new Set(hiddenColumnIds);
  let ordered = defaultCols;
  if (columnOrder.length > 0) {
    const orderMap = new Map(columnOrder.map((id, i) => [id, i]));
    ordered = [...defaultCols].sort((a, b) => {
      const ai = orderMap.get(a.id) ?? Number.MAX_SAFE_INTEGER;
      const bi = orderMap.get(b.id) ?? Number.MAX_SAFE_INTEGER;
      return ai - bi;
    });
  }
  return ordered.map(c => ({
    ...c,
    isShown: !hiddenSet.has(c.id)
  }));
};

export const useManagedListColumns = ({
  actions,
  columnOrder,
  columnOrderUrlParam,
  dispatch,
  hiddenColumnIds,
  hiddenColumnsUrlParam,
  hideClusterColumnInModal = false,
  listType,
  untoggleableColumnId
}: ManagedListColumnsConfig): UseManagedListColumnsResult => {
  const syncColumnsFromURL = useCallback((): void => {
    const defaultIds = getDefaultManagedColumns(listType, untoggleableColumnId).map(c => c.id);
    const validIds = defaultIds.filter(id => id !== untoggleableColumnId);

    const urlParam = HistoryManager.getParam(hiddenColumnsUrlParam);
    if (urlParam !== undefined) {
      const ids = urlParam
        .split(',')
        .map(s => s.trim().toLowerCase())
        .filter(Boolean);
      const filtered = ids.filter(id => validIds.includes(id));
      if (filtered.length > 0 && !arrayEquals(filtered, hiddenColumnIds, (a, b) => a === b)) {
        dispatch(actions.setHiddenColumns(filtered));
      } else if (filtered.length === 0 && hiddenColumnIds.length > 0) {
        dispatch(actions.setHiddenColumns([]));
      }
    } else if (hiddenColumnIds.length > 0) {
      HistoryManager.setParam(hiddenColumnsUrlParam, hiddenColumnIds.join(','));
    }

    const orderParam = HistoryManager.getParam(columnOrderUrlParam);
    if (orderParam !== undefined) {
      const orderIds = orderParam
        .split(',')
        .map(s => s.trim().toLowerCase())
        .filter(Boolean);
      const validOrder = orderIds.filter(id => defaultIds.includes(id));
      if (validOrder.length > 0 && !arrayEquals(validOrder, columnOrder, (a, b) => a === b)) {
        dispatch(actions.setColumnOrder(validOrder));
      } else if (validOrder.length === 0 && columnOrder.length > 0) {
        dispatch(actions.setColumnOrder([]));
      }
    } else if (columnOrder.length > 0) {
      HistoryManager.setParam(columnOrderUrlParam, columnOrder.join(','));
    }
  }, [
    actions,
    columnOrder,
    columnOrderUrlParam,
    dispatch,
    hiddenColumnIds,
    hiddenColumnsUrlParam,
    listType,
    untoggleableColumnId
  ]);

  const resetColumnsToDefault = useCallback((): void => {
    dispatch(actions.setColumnOrder([]));
    dispatch(actions.setHiddenColumns([]));
    HistoryManager.deleteParam(columnOrderUrlParam);
    HistoryManager.deleteParam(hiddenColumnsUrlParam);
  }, [actions, columnOrderUrlParam, dispatch, hiddenColumnsUrlParam]);

  const applyColumns = useCallback(
    (newColumns: ColumnManagementModalColumn[]): void => {
      const hiddenIds = newColumns.filter(c => !c.isShown).map(c => c.key);
      const orderedIds = newColumns.map(c => c.key);

      dispatch(actions.setColumnOrder(orderedIds));
      if (orderedIds.length > 0) {
        HistoryManager.setParam(columnOrderUrlParam, orderedIds.join(','));
      } else {
        HistoryManager.deleteParam(columnOrderUrlParam);
      }

      dispatch(actions.setHiddenColumns(hiddenIds));
      if (hiddenIds.length > 0) {
        HistoryManager.setParam(hiddenColumnsUrlParam, hiddenIds.join(','));
      } else {
        HistoryManager.deleteParam(hiddenColumnsUrlParam);
      }
    },
    [actions, columnOrderUrlParam, dispatch, hiddenColumnsUrlParam]
  );

  const appliedColumns = useMemo((): ColumnManagementModalColumn[] => {
    const managedColumns = getManagedColumns(listType, untoggleableColumnId, columnOrder, hiddenColumnIds);
    const visibleColumns =
      hideClusterColumnInModal && !isMultiCluster ? managedColumns.filter(c => c.id !== 'cluster') : managedColumns;

    return visibleColumns.map(c => ({
      isShown: c.isShown,
      isShownByDefault: true,
      isUntoggleable: c.id === untoggleableColumnId,
      key: c.id,
      title: c.title
    }));
  }, [columnOrder, hiddenColumnIds, hideClusterColumnInModal, listType, untoggleableColumnId]);

  return {
    appliedColumns,
    applyColumns,
    resetColumnsToDefault,
    syncColumnsFromURL
  };
};

export const applicationsListColumnsPreset = {
  actions: AppsListActions,
  columnOrderUrlParam: URLParam.APPS_COLUMN_ORDER,
  hiddenColumnsUrlParam: URLParam.APPS_HIDDEN_COLUMNS,
  hideClusterColumnInModal: true,
  listType: 'applications' as ManagedListPageType,
  untoggleableColumnId: 'name'
};

export const servicesListColumnsPreset = {
  actions: ServicesListActions,
  columnOrderUrlParam: URLParam.SERVICES_COLUMN_ORDER,
  hiddenColumnsUrlParam: URLParam.SERVICES_HIDDEN_COLUMNS,
  hideClusterColumnInModal: true,
  listType: 'services' as ManagedListPageType,
  untoggleableColumnId: 'name'
};

export const workloadsListColumnsPreset = {
  actions: WorkloadsListActions,
  columnOrderUrlParam: URLParam.WORKLOADS_COLUMN_ORDER,
  hiddenColumnsUrlParam: URLParam.WORKLOADS_HIDDEN_COLUMNS,
  hideClusterColumnInModal: true,
  listType: 'workloads' as ManagedListPageType,
  untoggleableColumnId: 'name'
};

export const namespacesListColumnsPreset = {
  actions: NamespacesListActions,
  columnOrderUrlParam: URLParam.NAMESPACES_COLUMN_ORDER,
  hiddenColumnsUrlParam: URLParam.NAMESPACES_HIDDEN_COLUMNS,
  listType: 'namespaces' as ManagedListPageType,
  untoggleableColumnId: 'namespace'
};
