import * as React from 'react';
import * as FilterHelper from '../../components/FilterList/FilterHelper';
import { RenderContent } from '../../components/Nav/Page';
import * as WorkloadListFilters from './FiltersAndSorts';
import * as FilterComponent from '../../components/FilterList/FilterComponent';
import { WorkloadListItem, ClusterWorkloadsResponse } from '../../types/Workload';
import { InstanceType, DurationInSeconds, TimeInMilliseconds, IntervalInMilliseconds } from '../../types/Common';
import { Namespace } from '../../types/Namespace';
import { PromisesRegistry } from '../../utils/CancelablePromises';
import { namespaceEquals } from '../../utils/Common';
import { SortField } from '../../types/SortFilters';
import { ActiveFiltersInfo, ActiveTogglesInfo } from '../../types/Filters';
import { FilterSelected, StatefulFilters, Toggles } from '../../components/Filters/StatefulFilters';
import * as API from '../../services/Api';
import { VirtualList } from '../../components/VirtualList/VirtualList';
import { KialiAppState } from '../../store/Store';
import { activeNamespacesSelector, durationSelector, refreshIntervalSelector } from '../../store/Selectors';
import { connect } from 'react-redux';
import { DefaultSecondaryMasthead } from '../../components/DefaultSecondaryMasthead/DefaultSecondaryMasthead';
import { TimeDurationComponent } from '../../components/Time/TimeDurationComponent';
import { sortIstioReferences } from '../AppList/FiltersAndSorts';
import { WorkloadHealth } from '../../types/Health';
import { isMultiCluster, serverConfig } from 'config';
import { validationKey } from '../../types/IstioConfigList';
import { connectRefresh } from 'components/Refresh/connectRefresh';
import { RefreshIntervalManual, RefreshIntervalPause } from 'config/Config';
import { EmptyVirtualList } from 'components/VirtualList/EmptyVirtualList';
import { HistoryManager } from 'app/History';
import { endPerfTimer, startPerfTimer } from '../../utils/PerformanceUtils';

type WorkloadListPageState = FilterComponent.State<WorkloadListItem> & {
  loaded: boolean;
};

type ReduxProps = {
  activeNamespaces: Namespace[];
  duration: DurationInSeconds;
  refreshInterval: IntervalInMilliseconds;
};

type WorkloadListPageProps = ReduxProps & {
  lastRefreshAt: TimeInMilliseconds; // redux by way of ConnectRefresh
};

class WorkloadListPageComponent extends FilterComponent.Component<
  WorkloadListPageProps,
  WorkloadListPageState,
  WorkloadListItem
> {
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
      loaded: false
    };
  }

  componentDidMount(): void {
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
          this.props.duration !== prevProps.duration ||
          (this.props.refreshInterval !== prevProps.refreshInterval &&
            this.props.refreshInterval !== RefreshIntervalPause) ||
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
      this.fetchWorkloads(Array.from(uniqueClusters), activeFilters, activeToggles, this.props.duration);
    } else {
      this.setState({ listItems: [], loaded: true });
    }
  }

  getDeploymentItems(data: ClusterWorkloadsResponse): WorkloadListItem[] {
    if (data.workloads) {
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
        health: WorkloadHealth.fromJson(deployment.namespace, deployment.name, deployment.health, {
          rateInterval: this.props.duration,
          hasSidecar: deployment.istioSidecar,
          hasAmbient: deployment.isAmbient
        }),
        labels: deployment.labels,
        istioReferences: sortIstioReferences(deployment.istioReferences, true),
        validations: data.validations['workload'][validationKey(deployment.name, deployment.namespace)]
      }));
    }

    return [];
  }

  fetchWorkloads(
    clusters: string[],
    filters: ActiveFiltersInfo,
    toggles: ActiveTogglesInfo,
    rateInterval: number
  ): void {
    const perfKey = 'ClustersWorkloads';
    const workloadsConfigPromises = clusters.map(cluster => {
      const health = toggles.get('health') ? 'true' : 'false';
      const istioResources = toggles.get('istioResources') ? 'true' : 'false';
      startPerfTimer(perfKey);
      return API.getClustersWorkloads(
        this.props.activeNamespaces.map(ns => ns.name).join(','),
        {
          health: health,
          istioResources: istioResources,
          rateInterval: `${String(rateInterval)}s`
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

        this.setState({
          listItems: this.sortItemList(workloadsItems, this.state.currentSortField, this.state.isSortAscending),
          loaded: true
        });
      })
      .catch(err => {
        if (!err.isCanceled) {
          console.info(`error: ${err}`);
          this.handleApiError('Could not fetch workloads list', err);
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

    return (
      <>
        <DefaultSecondaryMasthead
          rightToolbar={
            <TimeDurationComponent key="DurationDropdown" id="workload-list-duration-dropdown" disabled={false} />
          }
        />
        <EmptyVirtualList loaded={this.state.loaded} refreshInterval={this.props.refreshInterval}>
          <RenderContent>
            <VirtualList rows={this.state.listItems} hiddenColumns={hiddenColumns} sort={this.onSort} type="workloads">
              <StatefulFilters
                initialFilters={WorkloadListFilters.availableFilters}
                initialToggles={this.initialToggles}
                onFilterChange={this.onFilterChange}
                onToggleChange={this.onFilterChange}
              />
            </VirtualList>
          </RenderContent>
        </EmptyVirtualList>
      </>
    );
  }
}

const mapStateToProps = (state: KialiAppState): ReduxProps => ({
  activeNamespaces: activeNamespacesSelector(state),
  duration: durationSelector(state),
  refreshInterval: refreshIntervalSelector(state)
});

export const WorkloadListPage = connectRefresh(connect(mapStateToProps)(WorkloadListPageComponent));
