import * as React from 'react';
import * as FilterHelper from '../../components/FilterList/FilterHelper';
import { RenderContent } from '../../components/Nav/Page';
import * as WorkloadListFilters from './FiltersAndSorts';
import * as FilterComponent from '../../components/FilterList/FilterComponent';
import { WorkloadListItem, ClusterWorkloadsResponse } from '../../types/Workload';
import { DurationInSeconds } from '../../types/Common';
import { Namespace } from '../../types/Namespace';
import { PromisesRegistry } from '../../utils/CancelablePromises';
import { namespaceEquals } from '../../utils/Common';
import { SortField } from '../../types/SortFilters';
import { ActiveFiltersInfo, ActiveTogglesInfo } from '../../types/Filters';
import { FilterSelected, StatefulFilters, Toggles } from '../../components/Filters/StatefulFilters';
import * as API from '../../services/Api';
import { VirtualList } from '../../components/VirtualList/VirtualList';
import { KialiAppState } from '../../store/Store';
import { activeNamespacesSelector, durationSelector } from '../../store/Selectors';
import { connect } from 'react-redux';
import { DefaultSecondaryMasthead } from '../../components/DefaultSecondaryMasthead/DefaultSecondaryMasthead';
import { TimeDurationComponent } from '../../components/Time/TimeDurationComponent';
import { sortIstioReferences } from '../AppList/FiltersAndSorts';
import { hasMissingAuthPolicy } from 'utils/IstioConfigUtils';
import { WorkloadHealth } from '../../types/Health';
import { RefreshNotifier } from '../../components/Refresh/RefreshNotifier';
import { isMultiCluster, serverConfig } from 'config';
import { validationKey } from '../../types/IstioConfigList';

type WorkloadListPageState = FilterComponent.State<WorkloadListItem>;

type ReduxProps = {
  activeNamespaces: Namespace[];
  duration: DurationInSeconds;
};

type WorkloadListPageProps = ReduxProps;

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
      listItems: [],
      currentSortField: prevCurrentSortField,
      isSortAscending: prevIsSortAscending
    };
  }

  componentDidMount(): void {
    this.updateListItems();
  }

  componentDidUpdate(prevProps: WorkloadListPageProps): void {
    const prevCurrentSortField = FilterHelper.currentSortField(WorkloadListFilters.sortFields);
    const prevIsSortAscending = FilterHelper.isCurrentSortAscending();

    if (
      !namespaceEquals(this.props.activeNamespaces, prevProps.activeNamespaces) ||
      this.props.duration !== prevProps.duration ||
      this.state.currentSortField !== prevCurrentSortField ||
      this.state.isSortAscending !== prevIsSortAscending
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
      this.setState({ listItems: [] });
    }
  }

  getDeploymentItems = (data: ClusterWorkloadsResponse): WorkloadListItem[] => {
    if (data.workloads) {
      return data.workloads.map(deployment => ({
        cluster: deployment.cluster,
        namespace: deployment.namespace,
        name: deployment.name,
        type: deployment.type,
        appLabel: deployment.appLabel,
        versionLabel: deployment.versionLabel,
        istioSidecar: deployment.istioSidecar,
        isAmbient: deployment.isAmbient,
        additionalDetailSample: deployment.additionalDetailSample,
        health: WorkloadHealth.fromJson(deployment.namespace, deployment.name, deployment.health, {
          rateInterval: this.props.duration,
          hasSidecar: deployment.istioSidecar,
          hasAmbient: deployment.isAmbient
        }),
        labels: deployment.labels,
        istioReferences: sortIstioReferences(deployment.istioReferences, true),
        notCoveredAuthPolicy: hasMissingAuthPolicy(
          validationKey(deployment.name, deployment.namespace),
          data.validations
        )
      }));
    }

    return [];
  };

  fetchWorkloads(
    clusters: string[],
    filters: ActiveFiltersInfo,
    toggles: ActiveTogglesInfo,
    rateInterval: number
  ): void {
    const workloadsConfigPromises = clusters.map(cluster => {
      const health = toggles.get('health') ? 'true' : 'false';
      const istioResources = toggles.get('istioResources') ? 'true' : 'false';

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
          workloadsItems = workloadsItems.concat(this.getDeploymentItems(response.data));
        });

        return WorkloadListFilters.filterBy(workloadsItems, filters);
      })
      .then(workloadsItems => {
        this.promises.cancel('sort');

        this.setState({
          listItems: this.sortItemList(workloadsItems, this.state.currentSortField, this.state.isSortAscending)
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
        <RefreshNotifier onTick={this.updateListItems} />

        <DefaultSecondaryMasthead
          rightToolbar={
            <TimeDurationComponent key="DurationDropdown" id="workload-list-duration-dropdown" disabled={false} />
          }
        />

        <RenderContent>
          <VirtualList rows={this.state.listItems} hiddenColumns={hiddenColumns} type="workloads">
            <StatefulFilters
              initialFilters={WorkloadListFilters.availableFilters}
              initialToggles={this.initialToggles}
              onFilterChange={this.onFilterChange}
              onToggleChange={this.onFilterChange}
            />
          </VirtualList>
        </RenderContent>
      </>
    );
  }
}

const mapStateToProps = (state: KialiAppState): ReduxProps => ({
  activeNamespaces: activeNamespacesSelector(state),
  duration: durationSelector(state)
});

export const WorkloadListPage = connect(mapStateToProps)(WorkloadListPageComponent);
