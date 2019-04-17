import * as React from 'react';
import * as API from '../../services/Api';
import Namespace from '../../types/Namespace';
import { WorkloadListItem, WorkloadNamespaceResponse } from '../../types/Workload';
import { WorkloadListFilters } from './FiltersAndSorts';
import { FilterSelected, StatefulFilters } from '../../components/Filters/StatefulFilters';
import { Button, Icon, ListView, Paginator, Sort, ToolbarRightContent } from 'patternfly-react';
import { ActiveFilter } from '../../types/Filters';
import { PromisesRegistry } from '../../utils/CancelablePromises';
import ItemDescription from './ItemDescription';
import { ListPagesHelper } from '../../components/ListPage/ListPagesHelper';
import { SortField } from '../../types/SortFilters';
import { ListComponent } from '../../components/ListPage/ListComponent';
import { AlignRightStyle, ThinStyle } from '../../components/Filters/FilterStyles';
import { arrayEquals } from '../../utils/Common';

interface WorkloadListComponentState extends ListComponent.State<WorkloadListItem> {
  rateInterval: number;
}

interface WorkloadListComponentProps extends ListComponent.Props<WorkloadListItem> {
  rateInterval: number;
  activeNamespaces: Namespace[];
}

class WorkloadListComponent extends ListComponent.Component<
  WorkloadListComponentProps,
  WorkloadListComponentState,
  WorkloadListItem
> {
  private promises = new PromisesRegistry();

  constructor(props: WorkloadListComponentProps) {
    super(props);
    this.state = {
      listItems: [],
      pagination: this.props.pagination,
      currentSortField: this.props.currentSortField,
      isSortAscending: this.props.isSortAscending,
      rateInterval: this.props.rateInterval
    };
  }

  componentDidMount() {
    this.updateListItems();
  }

  componentDidUpdate(prevProps: WorkloadListComponentProps, prevState: WorkloadListComponentState, snapshot: any) {
    if (!this.paramsAreSynced(prevProps)) {
      this.setState({
        pagination: this.props.pagination,
        currentSortField: this.props.currentSortField,
        isSortAscending: this.props.isSortAscending,
        rateInterval: this.props.rateInterval
      });

      this.updateListItems();
    }
  }

  componentWillUnmount() {
    this.promises.cancelAll();
  }

  paramsAreSynced(prevProps: WorkloadListComponentProps) {
    const activeNamespacesCompare = arrayEquals(
      prevProps.activeNamespaces,
      this.props.activeNamespaces,
      (n1, n2) => n1.name === n2.name
    );
    return (
      prevProps.pagination.page === this.props.pagination.page &&
      prevProps.pagination.perPage === this.props.pagination.perPage &&
      prevProps.rateInterval === this.props.rateInterval &&
      activeNamespacesCompare &&
      prevProps.isSortAscending === this.props.isSortAscending &&
      prevProps.currentSortField.title === this.props.currentSortField.title
    );
  }

  sortItemList(workloads: WorkloadListItem[], sortField: SortField<WorkloadListItem>, isAscending: boolean) {
    // Chain promises, as there may be an ongoing fetch/refresh and sort can be called after UI interaction
    // This ensures that the list will display the new data with the right sorting
    return this.promises.registerChained('sort', workloads, unsorted =>
      WorkloadListFilters.sortWorkloadsItems(unsorted, sortField, isAscending)
    );
  }

  updateListItems(resetPagination?: boolean) {
    this.promises.cancelAll();

    const activeFilters: ActiveFilter[] = FilterSelected.getSelected();
    const namespacesSelected = this.props.activeNamespaces.map(item => item.name);

    if (namespacesSelected.length === 0) {
      this.promises
        .register('namespaces', API.getNamespaces())
        .then(namespacesResponse => {
          const namespaces: Namespace[] = namespacesResponse.data;
          this.fetchWorkloads(namespaces.map(namespace => namespace.name), activeFilters, resetPagination);
        })
        .catch(namespacesError => {
          if (!namespacesError.isCanceled) {
            this.handleAxiosError('Could not fetch namespace list', namespacesError);
          }
        });
    } else {
      this.fetchWorkloads(namespacesSelected, activeFilters, resetPagination);
    }
  }

  getDeploymentItems = (data: WorkloadNamespaceResponse): WorkloadListItem[] => {
    if (data.workloads) {
      return data.workloads.map(deployment => ({
        namespace: data.namespace.name,
        workload: deployment,
        healthPromise: API.getWorkloadHealth(
          data.namespace.name,
          deployment.name,
          this.state.rateInterval,
          deployment.istioSidecar
        )
      }));
    }
    return [];
  };

  fetchWorkloads(namespaces: string[], filters: ActiveFilter[], resetPagination?: boolean) {
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
        const currentPage = resetPagination ? 1 : this.state.pagination.page;
        this.promises.cancel('sort');
        this.sortItemList(workloadsItems, this.state.currentSortField, this.state.isSortAscending)
          .then(sorted => {
            this.setState(prevState => {
              return {
                listItems: sorted,
                pagination: {
                  page: currentPage,
                  perPage: prevState.pagination.perPage,
                  perPageOptions: ListPagesHelper.perPageOptions
                }
              };
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
    const workloadList: React.ReactElement<{}>[] = [];
    const pageStart = (this.state.pagination.page - 1) * this.state.pagination.perPage;
    let pageEnd = pageStart + this.state.pagination.perPage;
    pageEnd = pageEnd < this.state.listItems.length ? pageEnd : this.state.listItems.length;

    for (let i = pageStart; i < pageEnd; i++) {
      workloadList.push(
        <ItemDescription
          workloadItem={this.state.listItems[i]}
          key={`ItemDescription_${this.state.listItems[i].workload.name}_${i}`}
          position={i}
        />
      );
    }

    return (
      <>
        <StatefulFilters initialFilters={WorkloadListFilters.availableFilters} onFilterChange={this.onFilterChange}>
          <Sort style={{ ...ThinStyle }}>
            <Sort.TypeSelector
              sortTypes={WorkloadListFilters.sortFields}
              currentSortType={this.state.currentSortField}
              onSortTypeSelected={this.updateSortField}
            />
            <Sort.DirectionSelector
              isNumeric={this.state.currentSortField.isNumeric}
              isAscending={this.state.isSortAscending}
              onClick={this.updateSortDirection}
            />
          </Sort>
          <ToolbarRightContent style={{ ...AlignRightStyle }}>
            <Button onClick={this.updateListItems}>
              <Icon name="refresh" />
            </Button>
          </ToolbarRightContent>
        </StatefulFilters>
        <ListView>{workloadList}</ListView>
        <Paginator
          viewType="list"
          pagination={this.state.pagination}
          itemCount={this.state.listItems.length}
          onPageSet={this.pageSet}
          onPerPageSelect={this.perPageSelect}
        />
      </>
    );
  }
}

export default WorkloadListComponent;
