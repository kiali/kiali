import * as React from 'react';
import { connect } from 'react-redux';
import * as API from '../../services/Api';
import Namespace from '../../types/Namespace';
import { WorkloadListItem, WorkloadNamespaceResponse } from '../../types/Workload';
import * as WorkloadListFilters from './FiltersAndSorts';
import { FilterSelected, StatefulFilters } from '../../components/Filters/StatefulFilters';
import { ActiveFilter } from '../../types/Filters';
import { PromisesRegistry } from '../../utils/CancelablePromises';
import { SortField } from '../../types/SortFilters';
import * as FilterComponent from '../../components/FilterList/FilterComponent';
import { namespaceEquals } from '../../utils/Common';
import { KialiAppState } from '../../store/Store';
import { activeNamespacesSelector, durationSelector } from '../../store/Selectors';
import { DurationInSeconds } from '../../types/Common';
import VirtualList from '../../components/VirtualList/VirtualList';
import TimeControlsContainer from 'components/Time/TimeControls';

type WorkloadListComponentState = FilterComponent.State<WorkloadListItem>;

type ReduxProps = {
  duration: DurationInSeconds;
  activeNamespaces: Namespace[];
};

type WorkloadListComponentProps = ReduxProps & FilterComponent.Props<WorkloadListItem>;

class WorkloadListComponent extends FilterComponent.Component<
  WorkloadListComponentProps,
  WorkloadListComponentState,
  WorkloadListItem
> {
  private promises = new PromisesRegistry();

  constructor(props: WorkloadListComponentProps) {
    super(props);
    this.state = {
      listItems: [],
      currentSortField: this.props.currentSortField,
      isSortAscending: this.props.isSortAscending
    };
  }

  componentDidMount() {
    this.updateListItems();
  }

  componentDidUpdate(prevProps: WorkloadListComponentProps, _prevState: WorkloadListComponentState, _snapshot: any) {
    const [paramsSynced] = this.paramsAreSynced(prevProps);
    if (!paramsSynced) {
      this.setState({
        currentSortField: this.props.currentSortField,
        isSortAscending: this.props.isSortAscending
      });

      this.updateListItems();
    }
  }

  componentWillUnmount() {
    this.promises.cancelAll();
  }

  paramsAreSynced = (prevProps: WorkloadListComponentProps): [boolean, boolean] => {
    const activeNamespacesCompare = namespaceEquals(prevProps.activeNamespaces, this.props.activeNamespaces);
    const paramsSynced =
      prevProps.duration === this.props.duration &&
      activeNamespacesCompare &&
      prevProps.isSortAscending === this.props.isSortAscending &&
      prevProps.currentSortField.title === this.props.currentSortField.title;
    return [paramsSynced, activeNamespacesCompare];
  };

  sortItemList(workloads: WorkloadListItem[], sortField: SortField<WorkloadListItem>, isAscending: boolean) {
    // Chain promises, as there may be an ongoing fetch/refresh and sort can be called after UI interaction
    // This ensures that the list will display the new data with the right sorting
    return this.promises.registerChained('sort', workloads, unsorted =>
      WorkloadListFilters.sortWorkloadsItems(unsorted, sortField, isAscending)
    );
  }

  updateListItems() {
    this.promises.cancelAll();

    const activeFilters: ActiveFilter[] = FilterSelected.getSelected();
    const namespacesSelected = this.props.activeNamespaces.map(item => item.name);

    if (namespacesSelected.length === 0) {
      this.promises
        .register('namespaces', API.getNamespaces())
        .then(namespacesResponse => {
          const namespaces: Namespace[] = namespacesResponse.data;
          this.fetchWorkloads(namespaces.map(namespace => namespace.name), activeFilters);
        })
        .catch(namespacesError => {
          if (!namespacesError.isCanceled) {
            this.handleAxiosError('Could not fetch namespace list', namespacesError);
          }
        });
    } else {
      this.fetchWorkloads(namespacesSelected, activeFilters);
    }
  }

  getDeploymentItems = (data: WorkloadNamespaceResponse): WorkloadListItem[] => {
    if (data.workloads) {
      return data.workloads.map(deployment => ({
        namespace: data.namespace.name,
        name: deployment.name,
        type: deployment.type,
        appLabel: deployment.appLabel,
        versionLabel: deployment.versionLabel,
        istioSidecar: deployment.istioSidecar,
        additionalDetailSample: deployment.additionalDetailSample,
        healthPromise: API.getWorkloadHealth(
          data.namespace.name,
          deployment.name,
          this.props.duration,
          deployment.istioSidecar
        ),
        labels: deployment.labels
      }));
    }
    return [];
  };

  fetchWorkloads(namespaces: string[], filters: ActiveFilter[]) {
    const workloadsConfigPromises = namespaces.map(namespace => API.getWorkloads(namespace));
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
        this.sortItemList(workloadsItems, this.state.currentSortField, this.state.isSortAscending)
          .then(sorted => {
            this.setState({
              listItems: sorted
            });
          })
          .catch(err => {
            if (!err.isCanceled) {
              console.debug(err);
            }
          });
      })
      .catch(err => {
        if (!err.isCanceled) {
          this.handleAxiosError('Could not fetch workloads list', err);
        }
      });
  }

  render() {
    return (
      <VirtualList rows={this.state.listItems}>
        <StatefulFilters
          initialFilters={WorkloadListFilters.availableFilters}
          onFilterChange={this.onFilterChange}
          rightToolbar={[
            <TimeControlsContainer
              key={'DurationDropdown'}
              id="workload-list-duration-dropdown"
              handleRefresh={this.updateListItems}
              disabled={false}
            />
          ]}
        />
      </VirtualList>
    );
  }
}

const mapStateToProps = (state: KialiAppState) => ({
  activeNamespaces: activeNamespacesSelector(state),
  duration: durationSelector(state)
});

const WorkloadListContainer = connect(mapStateToProps)(WorkloadListComponent);
export default WorkloadListContainer;
