import * as React from 'react';
import * as FilterHelper from '../../components/FilterList/FilterHelper';
import { RenderContent } from '../../components/Nav/Page';
import * as WorkloadListFilters from './FiltersAndSorts';
import * as FilterComponent from '../../components/FilterList/FilterComponent';
import type { WorkloadListItem, ClusterWorkloadsResponse } from '../../types/Workload';
import type { TimeInMilliseconds, IntervalInMilliseconds } from '../../types/Common';
import { InstanceType } from '../../types/Common';
import type { Namespace } from '../../types/Namespace';
import { PromisesRegistry } from '../../utils/CancelablePromises';
import { namespaceEquals } from '../../utils/Common';
import type { SortField } from '../../types/SortFilters';
import type { ActiveFiltersInfo, ActiveTogglesInfo } from '../../types/Filters';
import { FilterSelected, StatefulFilters, Toggles } from '../../components/Filters/StatefulFilters';
import * as API from '../../services/Api';
import { addError } from '../../utils/AlertUtils';
import { VirtualList } from '../../components/VirtualList/VirtualList';
import type { KialiAppState } from '../../store/Store';
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
import { HistoryManager } from 'app/History';
import { endPerfTimer, startPerfTimer } from '../../utils/PerformanceUtils';
import { ManagedListColumnsModal } from '../../components/Filters/ManagedListColumnsModal';
import { workloadsListColumnsPreset } from '../../hooks/managedListColumnsPresets';
import { syncManagedListColumnsFromURL } from '../../hooks/useManagedListColumns';
import type { KialiDispatch } from 'types/Redux';
import type { StatefulFiltersRef } from '../../components/Filters/StatefulFilters';

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
    syncManagedListColumnsFromURL({
      ...workloadsListColumnsPreset,
      columnOrder: this.props.columnOrder,
      dispatch: this.props.dispatch,
      hiddenColumnIds: this.props.hiddenColumnIds
    });
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

        <ManagedListColumnsModal
          {...workloadsListColumnsPreset}
          columnOrder={this.props.columnOrder}
          dispatch={this.props.dispatch}
          hiddenColumnIds={this.props.hiddenColumnIds}
          isOpen={this.state.showColumnManagement}
          onClose={() => this.setState({ showColumnManagement: false })}
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
