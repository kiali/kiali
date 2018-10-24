import * as React from 'react';
import * as API from '../../services/Api';
import { authentication } from '../../utils/Authentication';
import Namespace from '../../types/Namespace';
import { WorkloadListItem, WorkloadNamespaceResponse } from '../../types/Workload';
import { WorkloadListFilters } from './FiltersAndSorts';
import { FilterSelected, StatefulFilters } from '../../components/Filters/StatefulFilters';
import { Button, Icon, ListView, Paginator, Sort, ToolbarRightContent } from 'patternfly-react';
import { ActiveFilter } from '../../types/Filters';
import { CancelablePromise, makeCancelablePromise, removeDuplicatesArray } from '../../utils/Common';
import ItemDescription from './ItemDescription';
import RateIntervalToolbarItem from '../ServiceList/RateIntervalToolbarItem';
import { ListPage } from '../../components/ListPage/ListPage';
import { SortField } from '../../types/SortFilters';
import { ListComponent } from '../../components/ListPage/ListComponent';
import { HistoryManager, URLParams } from '../../app/History';

interface WorkloadListComponentState extends ListComponent.State<WorkloadListItem> {
  rateInterval: number;
}

interface WorkloadListComponentProps extends ListComponent.Props<WorkloadListItem> {
  rateInterval: number;
}

class WorkloadListComponent extends ListComponent.Component<
  WorkloadListComponentProps,
  WorkloadListComponentState,
  WorkloadListItem
> {
  private nsPromise?: CancelablePromise<API.Response<Namespace[]>>;
  private workloadsPromise?: CancelablePromise<API.Response<WorkloadNamespaceResponse>[]>;
  private sortPromise?: CancelablePromise<WorkloadListItem[]>;

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
    this.cancelAsyncs();
  }

  paramsAreSynced(prevProps: WorkloadListComponentProps) {
    return (
      prevProps.pagination.page === this.props.pagination.page &&
      prevProps.pagination.perPage === this.props.pagination.perPage &&
      prevProps.rateInterval === this.props.rateInterval &&
      prevProps.isSortAscending === this.props.isSortAscending &&
      prevProps.currentSortField.title === this.props.currentSortField.title
    );
  }

  rateIntervalChangedHandler = (key: number) => {
    HistoryManager.setParam(URLParams.DURATION, String(key));
    this.setState({ rateInterval: key });
  };

  sortItemList(workloads: WorkloadListItem[], sortField: SortField<WorkloadListItem>, isAscending: boolean) {
    let lastSort: Promise<WorkloadListItem[]>;
    const sorter = unsorted => {
      this.sortPromise = makeCancelablePromise(
        WorkloadListFilters.sortWorkloadsItems(workloads, sortField, isAscending)
      );
      this.sortPromise.promise
        .then(() => {
          this.sortPromise = undefined;
        })
        .catch(() => {
          this.sortPromise = undefined;
        });
      return this.sortPromise.promise;
    };

    if (!this.sortPromise) {
      // If there is no "sortPromise" set, take the received (unsorted) list of workloads to sort
      // them and update the UI with the sorted list.
      lastSort = sorter(workloads);
    } else {
      // If there is a "sortPromise", there may be an ongoing fetch/refresh. So, the received <workloads> list argument
      // shoudn't be used as it may represent the "old" data before the refresh. Instead, append a callback to the
      // "sortPromise" to re-sort once the data is fetched. This ensures that the list will display the new data with
      // the right sorting.
      // (See other comments in the fetchWorkloads method)
      lastSort = this.sortPromise.promise.then(sorter);
    }

    return lastSort;
  }

  updateListItems(resetPagination?: boolean) {
    this.cancelAsyncs();

    const activeFilters: ActiveFilter[] = FilterSelected.getSelected();
    let namespacesSelected: string[] = activeFilters
      .filter(activeFilter => activeFilter.category === 'Namespace')
      .map(activeFilter => activeFilter.value);

    /** Remove duplicates  */
    namespacesSelected = removeDuplicatesArray(namespacesSelected);

    if (namespacesSelected.length === 0) {
      this.nsPromise = makeCancelablePromise(API.getNamespaces(authentication()));
      this.nsPromise.promise
        .then(namespacesResponse => {
          const namespaces: Namespace[] = namespacesResponse['data'];
          this.fetchWorkloads(namespaces.map(namespace => namespace.name), activeFilters, resetPagination);
          this.nsPromise = undefined;
        })
        .catch(namespacesError => {
          if (!namespacesError.isCanceled) {
            this.handleAxiosError('Could not fetch namespace list.', namespacesError);
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
          authentication(),
          data.namespace.name,
          deployment.name,
          this.state.rateInterval
        )
      }));
    }
    return [];
  };

  fetchWorkloads(namespaces: string[], filters: ActiveFilter[], resetPagination?: boolean) {
    const workloadsConfigPromises = namespaces.map(namespace => API.getWorkloads(authentication(), namespace));
    this.workloadsPromise = makeCancelablePromise(Promise.all(workloadsConfigPromises));
    this.workloadsPromise.promise
      .then(responses => {
        const currentPage = resetPagination ? 1 : this.state.pagination.page;
        let workloadsItems: WorkloadListItem[] = [];
        responses.forEach(response => {
          WorkloadListFilters.filterBy(response.data, filters);
          workloadsItems = workloadsItems.concat(this.getDeploymentItems(response.data));
        });
        if (this.sortPromise) {
          this.sortPromise.cancel();
        }
        // Promises for sorting are needed, because the user may have the list sorted using health/error rates
        // and these data can be fetched only after the list is retrieved. If the user is sorting using these
        // criteria, the update of the list is deferred after sorting is possible. This way, it's avoided the
        // illusion of double-fetch or flickering list.
        this.sortPromise = makeCancelablePromise(
          WorkloadListFilters.sortWorkloadsItems(
            workloadsItems,
            this.state.currentSortField,
            this.state.isSortAscending
          )
        );
        this.sortPromise.promise
          .then(sorted => {
            this.setState(prevState => {
              return {
                listItems: sorted,
                pagination: {
                  page: currentPage,
                  perPage: prevState.pagination.perPage,
                  perPageOptions: ListPage.perPageOptions
                }
              };
            });
            this.sortPromise = undefined;
          })
          .catch(err => {
            if (!err.isCanceled) {
              console.debug(err);
            }
            this.sortPromise = undefined;
          });
        this.workloadsPromise = undefined;
      })
      .catch(err => {
        if (!err.isCanceled) {
          console.debug(err);
        }
      });
  }

  render() {
    let workloadList: React.ReactElement<{}>[] = [];
    let pageStart = (this.state.pagination.page - 1) * this.state.pagination.perPage;
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
          <Sort>
            <Sort.TypeSelector
              sortTypes={WorkloadListFilters.sortFields}
              currentSortType={this.state.currentSortField}
              onSortTypeSelected={this.updateSortField}
            />
            <Sort.DirectionSelector
              isNumeric={false}
              isAscending={this.state.isSortAscending}
              onClick={this.updateSortDirection}
            />
          </Sort>
          <RateIntervalToolbarItem
            rateIntervalSelected={this.state.rateInterval}
            onRateIntervalChanged={this.rateIntervalChangedHandler}
          />
          <ToolbarRightContent>
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

  private cancelAsyncs = () => {
    if (this.nsPromise) {
      this.nsPromise.cancel();
      this.nsPromise = undefined;
    }
    if (this.workloadsPromise) {
      this.workloadsPromise.cancel();
      this.workloadsPromise = undefined;
    }
    if (this.sortPromise) {
      this.sortPromise.cancel();
      this.sortPromise = undefined;
    }
  };
}

export default WorkloadListComponent;
