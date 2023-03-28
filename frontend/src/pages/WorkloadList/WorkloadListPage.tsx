import * as React from 'react';
import * as FilterHelper from '../../components/FilterList/FilterHelper';
import { RenderContent } from '../../components/Nav/Page';
import * as WorkloadListFilters from './FiltersAndSorts';
import * as FilterComponent from '../../components/FilterList/FilterComponent';
import { WorkloadListItem, WorkloadNamespaceResponse } from '../../types/Workload';
import { DurationInSeconds } from '../../types/Common';
import Namespace from '../../types/Namespace';
import { PromisesRegistry } from '../../utils/CancelablePromises';
import { namespaceEquals } from '../../utils/Common';
import { SortField } from '../../types/SortFilters';
import { ActiveFiltersInfo, ActiveTogglesInfo } from '../../types/Filters';
import { FilterSelected, StatefulFilters, Toggles } from '../../components/Filters/StatefulFilters';
import * as API from '../../services/Api';
import VirtualList from '../../components/VirtualList/VirtualList';
import { KialiAppState } from '../../store/Store';
import { activeNamespacesSelector, durationSelector } from '../../store/Selectors';
import { connect } from 'react-redux';
import DefaultSecondaryMasthead from '../../components/DefaultSecondaryMasthead/DefaultSecondaryMasthead';
import TimeDurationContainer from '../../components/Time/TimeDurationComponent';
import { sortIstioReferences } from '../AppList/FiltersAndSorts';
import { hasMissingAuthPolicy } from 'utils/IstioConfigUtils';
import { WorkloadHealth } from '../../types/Health';
import RefreshNotifier from '../../components/Refresh/RefreshNotifier';
import { isMultiCluster } from 'config';

type WorkloadListPageState = FilterComponent.State<WorkloadListItem>;

type ReduxProps = {
  duration: DurationInSeconds;
  activeNamespaces: Namespace[];
};

type WorkloadListPageProps = ReduxProps & FilterComponent.Props<WorkloadListItem>;

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

  componentDidMount() {
    this.updateListItems();
  }

  componentDidUpdate(prevProps: WorkloadListPageProps, _prevState: WorkloadListPageState, _snapshot: any) {
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

  componentWillUnmount() {
    this.promises.cancelAll();
  }

  sortItemList(workloads: WorkloadListItem[], sortField: SortField<WorkloadListItem>, isAscending: boolean) {
    // Chain promises, as there may be an ongoing fetch/refresh and sort can be called after UI interaction
    // This ensures that the list will display the new data with the right sorting
    return WorkloadListFilters.sortWorkloadsItems(workloads, sortField, isAscending);
  }

  updateListItems() {
    this.promises.cancelAll();
    const activeFilters: ActiveFiltersInfo = FilterSelected.getSelected();
    const activeToggles: ActiveTogglesInfo = Toggles.getToggles();
    const namespacesSelected = this.props.activeNamespaces.map(item => item.name);
    if (namespacesSelected.length !== 0) {
      this.fetchWorkloads(namespacesSelected, activeFilters, activeToggles, this.props.duration);
    } else {
      this.setState({ listItems: [] });
    }
  }

  getDeploymentItems = (data: WorkloadNamespaceResponse): WorkloadListItem[] => {
    if (data.workloads) {
      return data.workloads.map(deployment => ({
        namespace: data.namespace.name,
        name: deployment.name,
        cluster: deployment.cluster,
        type: deployment.type,
        appLabel: deployment.appLabel,
        versionLabel: deployment.versionLabel,
        istioSidecar: deployment.istioSidecar,
        istioAmbient: deployment.istioAmbient,
        additionalDetailSample: deployment.additionalDetailSample,
        health: WorkloadHealth.fromJson(data.namespace.name, deployment.name, deployment.health, {
          rateInterval: this.props.duration,
          hasSidecar: deployment.istioSidecar,
          hasAmbient: deployment.istioAmbient
        }),
        labels: deployment.labels,
        istioReferences: sortIstioReferences(deployment.istioReferences, true),
        notCoveredAuthPolicy: hasMissingAuthPolicy(deployment.name, data.validations)
      }));
    }
    return [];
  };

  fetchWorkloads(namespaces: string[], filters: ActiveFiltersInfo, toggles: ActiveTogglesInfo, rateInterval: number) {
    const workloadsConfigPromises = namespaces.map(namespace => {
      const health = toggles.get('health') ? 'true' : 'false';
      const istioResources = toggles.get('istioResources') ? 'true' : 'false';
      return API.getWorkloads(namespace, {
        health: health,
        istioResources: istioResources,
        rateInterval: String(rateInterval) + 's'
      });
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
          console.log(`error: ${err}`);
          this.handleAxiosError('Could not fetch workloads list', err);
        }
      });
  }

  render() {
    const hiddenColumns = isMultiCluster() ? ([] as string[]) : ['cluster'];
    Toggles.getToggles().forEach((v, k) => {
      if (!v) {
        hiddenColumns.push(k);
      }
    });

    return (
      <>
        <RefreshNotifier onTick={this.updateListItems} />
        <div style={{ backgroundColor: '#fff' }}>
          <DefaultSecondaryMasthead
            rightToolbar={
              <TimeDurationContainer key={'DurationDropdown'} id="workload-list-duration-dropdown" disabled={false} />
            }
          />
        </div>
        <RenderContent>
          <VirtualList rows={this.state.listItems} hiddenColumns={hiddenColumns}>
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

const mapStateToProps = (state: KialiAppState) => ({
  activeNamespaces: activeNamespacesSelector(state),
  duration: durationSelector(state)
});

const WorkloadListPage = connect(mapStateToProps)(WorkloadListPageComponent);

export default WorkloadListPage;
