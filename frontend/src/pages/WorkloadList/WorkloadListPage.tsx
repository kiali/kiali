import * as React from 'react';
import * as FilterHelper from '../../components/FilterList/FilterHelper';
import { RenderContent } from '../../components/Nav/Page';
import * as WorkloadListFilters from './FiltersAndSorts';
import * as FilterComponent from '../../components/FilterList/FilterComponent';
import { WorkloadListItem, ClusterWorkloadsResponse } from '../../types/Workload';
import { InstanceType, TimeInMilliseconds, IntervalInMilliseconds } from '../../types/Common';
import { Namespace } from '../../types/Namespace';
import { PromisesRegistry } from '../../utils/CancelablePromises';
import { namespaceEquals } from '../../utils/Common';
import { SortField } from '../../types/SortFilters';
import { ActiveFiltersInfo, ActiveTogglesInfo } from '../../types/Filters';
import { FilterSelected, StatefulFilters, Toggles } from '../../components/Filters/StatefulFilters';
import * as API from '../../services/Api';
import { addError } from '../../utils/AlertUtils';
import { VirtualList } from '../../components/VirtualList/VirtualList';
import { KialiAppState } from '../../store/Store';
import { activeNamespacesSelector, refreshIntervalSelector } from '../../store/Selectors';
import { connect } from 'react-redux';
import { DefaultSecondaryMasthead } from '../../components/DefaultSecondaryMasthead/DefaultSecondaryMasthead';
import { HealthComputeDurationMastheadToolbar } from 'components/Time/HealthComputeDurationMastheadToolbar';
import { Refresh } from '../../components/Refresh/Refresh';
import { sortIstioReferences } from '../AppList/FiltersAndSorts';
import { WorkloadHealth } from '../../types/Health';
import { healthComputeDurationValidSeconds } from 'utils/HealthComputeDuration';
import { isMultiCluster, serverConfig } from 'config';
import { validationKey } from '../../types/IstioConfigList';
import { connectRefresh } from 'components/Refresh/connectRefresh';
import { RefreshIntervalManual, RefreshIntervalPause } from 'config/Config';
import { HistoryManager, URLParam } from 'app/History';
import { endPerfTimer, startPerfTimer } from '../../utils/PerformanceUtils';
import { arrayEquals } from '../../utils/Common';
import {
  ColumnManagementModalColumn,
  ListColumnManagementModal
} from '../../components/Filters/ListColumnManagementModal';
import { ManagedColumn } from '../../components/VirtualList/ManagedColumnTypes';
import { WorkloadsListActions } from '../../actions/WorkloadsListActions';
import { config as virtualListConfig } from '../../components/VirtualList/Config';
import { t } from 'utils/I18nUtils';
import { KialiDispatch } from 'types/Redux';
import { StatefulFiltersRef } from '../../components/Filters/StatefulFilters';

type WorkloadListPageState = FilterComponent.State<WorkloadListItem> & {
  loaded: boolean;
  showColumnManagement: boolean;
};

type ReduxProps = {
  activeNamespaces: Namespace[];
  columnOrder: string[];
  hiddenColumnIds: string[];
  refreshInterval: IntervalInMilliseconds;
};

type ReduxDispatchProps = {
  dispatch: KialiDispatch;
};

type WorkloadListPageProps = ReduxProps &
  ReduxDispatchProps & {
    lastRefreshAt: TimeInMilliseconds; // redux by way of ConnectRefresh
  };

class WorkloadListPageComponent extends FilterComponent.Component<
  WorkloadListPageProps,
  WorkloadListPageState,
  WorkloadListItem
> {
  private sFStatefulFilters: StatefulFiltersRef = React.createRef();
  private promises = new PromisesRegistry();
  private initialToggles = WorkloadListFilters.getAvailableToggles();

  constructor(props: WorkloadListPageProps) {
    super(props);
    const prevCurrentSortField = FilterHelper.currentSortField(WorkloadListFilters.sortFields);
    const prevIsSortAscending = FilterHelper.isCurrentSortAscending();

    this.state = {
      currentSortField: prevCurrentSortField,
      isSortAscending: prevIsSortAscending,
      listItems: [],
      loaded: false,
      showColumnManagement: false
    };
  }

  componentDidMount(): void {
    this.syncColumnsFromURL();
    if (this.props.refreshInterval !== RefreshIntervalManual && HistoryManager.getRefresh() !== RefreshIntervalManual) {
      this.updateListItems();
    }
  }

  componentDidUpdate(prevProps: WorkloadListPageProps): void {
    const prevCurrentSortField = FilterHelper.currentSortField(WorkloadListFilters.sortFields);
    const prevIsSortAscending = FilterHelper.isCurrentSortAscending();

    if (
      this.props.lastRefreshAt !== prevProps.lastRefreshAt ||
      (this.props.refreshInterval !== RefreshIntervalManual &&
        (!namespaceEquals(this.props.activeNamespaces, prevProps.activeNamespaces) ||
          (this.props.refreshInterval !== prevProps.refreshInterval &&
            (this.props.refreshInterval !== RefreshIntervalPause ||
              prevProps.refreshInterval === RefreshIntervalManual)) ||
          this.state.currentSortField !== prevCurrentSortField ||
          this.state.isSortAscending !== prevIsSortAscending))
    ) {
      this.setState({
        currentSortField: prevCurrentSortField,
        isSortAscending: prevIsSortAscending
      });

      this.updateListItems();
    }
  }

  componentWillUnmount(): void {
    this.promises.cancelAll();
  }

  private syncColumnsFromURL = (): void => {
    const defaultIds = this.getDefaultManagedColumns().map(c => c.id);
    const validIds = defaultIds.filter(id => id !== 'workload');

    const urlParam = HistoryManager.getParam(URLParam.WORKLOADS_HIDDEN_COLUMNS);
    if (urlParam !== undefined) {
      const ids = urlParam
        .split(',')
        .map(s => s.trim().toLowerCase())
        .filter(Boolean);
      const filtered = ids.filter(id => validIds.includes(id));
      if (filtered.length > 0 && !arrayEquals(filtered, this.props.hiddenColumnIds, (a, b) => a === b)) {
        this.props.dispatch(WorkloadsListActions.setHiddenColumns(filtered));
      } else if (filtered.length === 0 && this.props.hiddenColumnIds.length > 0) {
        this.props.dispatch(WorkloadsListActions.setHiddenColumns([]));
      }
    } else if (this.props.hiddenColumnIds.length > 0) {
      HistoryManager.setParam(URLParam.WORKLOADS_HIDDEN_COLUMNS, this.props.hiddenColumnIds.join(','));
    }

    const orderParam = HistoryManager.getParam(URLParam.WORKLOADS_COLUMN_ORDER);
    if (orderParam !== undefined) {
      const orderIds = orderParam
        .split(',')
        .map(s => s.trim().toLowerCase())
        .filter(Boolean);
      const validOrder = orderIds.filter(id => defaultIds.includes(id));
      if (validOrder.length > 0 && !arrayEquals(validOrder, this.props.columnOrder, (a, b) => a === b)) {
        this.props.dispatch(WorkloadsListActions.setColumnOrder(validOrder));
      } else if (validOrder.length === 0 && this.props.columnOrder.length > 0) {
        this.props.dispatch(WorkloadsListActions.setColumnOrder([]));
      }
    } else if (this.props.columnOrder.length > 0) {
      HistoryManager.setParam(URLParam.WORKLOADS_COLUMN_ORDER, this.props.columnOrder.join(','));
    }
  };

  private getDefaultManagedColumns = (): ManagedColumn[] => {
    return virtualListConfig.workloads.columns
      .filter(c => c.title && c.title.trim().length > 0)
      .map(c => {
        const id = (c.id ?? c.name.toLowerCase()).toLowerCase();
        return {
          id,
          title: c.title,
          isShown: true,
          isDisabled: id === 'workload'
        } as ManagedColumn;
      });
  };

  private getManagedColumns = (): ManagedColumn[] => {
    const defaultCols = this.getDefaultManagedColumns();
    const hiddenSet = new Set(this.props.hiddenColumnIds);
    let ordered = defaultCols;
    if (this.props.columnOrder && this.props.columnOrder.length > 0) {
      const orderMap = new Map(this.props.columnOrder.map((id, i) => [id, i]));
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

  private resetWorkloadsColumnsToDefault = (): void => {
    this.props.dispatch(WorkloadsListActions.setColumnOrder([]));
    this.props.dispatch(WorkloadsListActions.setHiddenColumns([]));
    HistoryManager.deleteParam(URLParam.WORKLOADS_COLUMN_ORDER);
    HistoryManager.deleteParam(URLParam.WORKLOADS_HIDDEN_COLUMNS);
  };

  private getAppliedColumnsForModal = (): ColumnManagementModalColumn[] => {
    return this.getManagedColumns()
      .filter(c => isMultiCluster || c.id !== 'cluster')
      .map(c => ({
        key: c.id,
        title: c.title,
        isShownByDefault: true,
        isShown: c.isShown,
        isUntoggleable: c.id === 'workload'
      }));
  };

  onSort = (): void => {
    // force list update on sorting
    this.setState({});
  };

  sortItemList(
    workloads: WorkloadListItem[],
    sortField: SortField<WorkloadListItem>,
    isAscending: boolean
  ): WorkloadListItem[] {
    // Chain promises, as there may be an ongoing fetch/refresh and sort can be called after UI interaction
    // This ensures that the list will display the new data with the right sorting
    return WorkloadListFilters.sortWorkloadsItems(workloads, sortField, isAscending);
  }

  updateListItems(): void {
    this.promises.cancelAll();
    const activeFilters: ActiveFiltersInfo = FilterSelected.getSelected();
    const activeToggles: ActiveTogglesInfo = Toggles.getToggles();
    const uniqueClusters = new Set<string>();

    Object.keys(serverConfig.clusters).forEach(cluster => {
      uniqueClusters.add(cluster);
    });

    if (this.props.activeNamespaces.length !== 0) {
      this.fetchWorkloads(Array.from(uniqueClusters), activeFilters, activeToggles);
    } else {
      this.setState({ listItems: [], loaded: true });
    }
  }

  getDeploymentItems(data: ClusterWorkloadsResponse): WorkloadListItem[] {
    if (data.workloads) {
      const rateInterval = healthComputeDurationValidSeconds();
      return data.workloads.map(deployment => ({
        cluster: deployment.cluster,
        namespace: deployment.namespace,
        name: deployment.name,
        instanceType: InstanceType.Workload,
        gvk: deployment.gvk,
        appLabel: deployment.appLabel,
        versionLabel: deployment.versionLabel,
        istioSidecar: deployment.istioSidecar,
        isAmbient: deployment.isAmbient,
        isGateway: deployment.isGateway,
        isWaypoint: deployment.isWaypoint,
        isZtunnel: deployment.isZtunnel,
        additionalDetailSample: deployment.additionalDetailSample,
        health: WorkloadHealth.fromJson(deployment.namespace, deployment.name, deployment.health ?? {}, {
          rateInterval,
          hasSidecar: deployment.istioSidecar,
          hasAmbient: deployment.isAmbient
        }),
        labels: deployment.labels,
        istioReferences: sortIstioReferences(deployment.istioReferences, true),
        validations: data.validations['workload']
          ? data.validations['workload'][validationKey(deployment.name, deployment.namespace)]
          : undefined,
        spireInfo: deployment.spireInfo
      }));
    }

    return [];
  }

  fetchWorkloads(clusters: string[], filters: ActiveFiltersInfo, toggles: ActiveTogglesInfo): void {
    const perfKey = 'ClustersWorkloads';
    const workloadsConfigPromises = clusters.map(cluster => {
      const health = toggles.get('health') ? 'true' : 'false';
      const istioResources = toggles.get('istioResources') ? 'true' : 'false';
      startPerfTimer(perfKey);
      return API.getClustersWorkloads(
        this.props.activeNamespaces.map(ns => ns.name).join(','),
        {
          health: health,
          istioResources: istioResources
        },
        cluster
      );
    });

    this.promises
      .registerAll('workloads', workloadsConfigPromises)
      .then(responses => {
        let workloadsItems: WorkloadListItem[] = [];

        responses.forEach(response => {
          endPerfTimer(perfKey);
          workloadsItems = workloadsItems.concat(this.getDeploymentItems(response.data));
        });

        return WorkloadListFilters.filterBy(workloadsItems, filters);
      })
      .then(workloadsItems => {
        this.promises.cancel('sort');

        const sortedWorkloadsItems = this.sortItemList(
          workloadsItems,
          this.state.currentSortField,
          this.state.isSortAscending
        );

        this.setState({
          listItems: sortedWorkloadsItems,
          loaded: true
        });
      })
      .catch(err => {
        if (!err.isCanceled) {
          addError('Could not fetch workloads list', err);
        }
      });
  }

  render(): React.ReactNode {
    const hiddenColumns = isMultiCluster ? [] : ['cluster'];

    Toggles.getToggles().forEach((v, k) => {
      if (!v) {
        hiddenColumns.push(k);
      }
    });

    const userHidden = this.props.hiddenColumnIds;
    const allHiddenColumns = hiddenColumns.concat(userHidden);

    return (
      <>
        <DefaultSecondaryMasthead
          rightToolbar={
            <HealthComputeDurationMastheadToolbar>
              <Refresh id="workload-list-refresh" disabled={false} manageURL={true} />
            </HealthComputeDurationMastheadToolbar>
          }
        />
        <RenderContent>
          <VirtualList
            loaded={this.state.loaded}
            refreshInterval={this.props.refreshInterval}
            rows={this.state.listItems}
            columnOrder={this.props.columnOrder}
            hiddenColumns={allHiddenColumns}
            sort={this.onSort}
            statefulProps={this.sFStatefulFilters}
            type="workloads"
          >
            <StatefulFilters
              columnManagement={true}
              columnManagementButtonTestId="workloads-manage-columns"
              initialFilters={WorkloadListFilters.availableFilters}
              initialToggles={this.initialToggles}
              onColumnManagementClick={() => this.setState({ showColumnManagement: true })}
              onFilterChange={this.onFilterChange}
              onToggleChange={this.onFilterChange}
              ref={this.sFStatefulFilters}
            />
          </VirtualList>
        </RenderContent>

        <ListColumnManagementModal
          appliedColumns={this.getAppliedColumnsForModal()}
          applyColumns={newColumns => {
            const hiddenIds = newColumns.filter(c => !c.isShown).map(c => c.key);
            const orderedIds = newColumns.map(c => c.key);
            this.props.dispatch(WorkloadsListActions.setColumnOrder(orderedIds));
            if (orderedIds.length > 0) {
              HistoryManager.setParam(URLParam.WORKLOADS_COLUMN_ORDER, orderedIds.join(','));
            } else {
              HistoryManager.deleteParam(URLParam.WORKLOADS_COLUMN_ORDER);
            }

            this.props.dispatch(WorkloadsListActions.setHiddenColumns(hiddenIds));
            if (hiddenIds.length > 0) {
              HistoryManager.setParam(URLParam.WORKLOADS_HIDDEN_COLUMNS, hiddenIds.join(','));
            } else {
              HistoryManager.deleteParam(URLParam.WORKLOADS_HIDDEN_COLUMNS);
            }

            this.setState({ showColumnManagement: false });
          }}
          description={t('Selected categories will be displayed in the table. Drag and drop to reorder columns.')}
          enableDragDrop={true}
          isOpen={this.state.showColumnManagement}
          onClose={() => this.setState({ showColumnManagement: false })}
          onResetToDefault={this.resetWorkloadsColumnsToDefault}
          title={t('Manage columns')}
        />
      </>
    );
  }
}

const mapStateToProps = (state: KialiAppState): ReduxProps => ({
  activeNamespaces: activeNamespacesSelector(state),
  columnOrder: state.workloadsList.columnOrder,
  hiddenColumnIds: state.workloadsList.hiddenColumnIds,
  refreshInterval: refreshIntervalSelector(state)
});

export const WorkloadListPage = connectRefresh(connect(mapStateToProps)(WorkloadListPageComponent));
