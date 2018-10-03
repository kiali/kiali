import * as React from 'react';
import * as API from '../../services/Api';
import { authentication } from '../../utils/Authentication';
import Namespace from '../../types/Namespace';
import { WorkloadListItem, WorkloadNamespaceResponse } from '../../types/Workload';
import { WorkloadListFilters } from './FiltersAndSorts';
import { FilterSelected, StatefulFilters } from '../../components/Filters/StatefulFilters';
import { Button, Icon, ListView, Paginator, Sort, ToolbarRightContent } from 'patternfly-react';
import { ActiveFilter } from '../../types/Filters';
import { removeDuplicatesArray } from '../../utils/Common';
import ItemDescription from './ItemDescription';
import RateIntervalToolbarItem from '../ServiceList/RateIntervalToolbarItem';
import { ListPage } from '../../components/ListPage/ListPage';
import { SortField } from '../../types/SortFilters';
import { ListComponent } from '../../components/ListPage/ListComponent';

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
    this.setState({ rateInterval: key });
    this.props.pageHooks.onParamChange([{ name: 'rate', value: String(key) }]);
    this.updateListItems();
  };

  sortItemList(workloads: WorkloadListItem[], sortField: SortField<WorkloadListItem>, isAscending: boolean) {
    return WorkloadListFilters.sortWorkloadsItems(workloads, sortField, isAscending);
  }

  updateListItems(resetPagination?: boolean) {
    const activeFilters: ActiveFilter[] = FilterSelected.getSelected();
    let namespacesSelected: string[] = activeFilters
      .filter(activeFilter => activeFilter.category === 'Namespace')
      .map(activeFilter => activeFilter.value);

    /** Remove duplicates  */
    namespacesSelected = removeDuplicatesArray(namespacesSelected);

    if (namespacesSelected.length === 0) {
      API.getNamespaces(authentication())
        .then(namespacesResponse => {
          const namespaces: Namespace[] = namespacesResponse['data'];
          this.fetchWorkloads(namespaces.map(namespace => namespace.name), activeFilters, resetPagination);
        })
        .catch(namespacesError => this.handleAxiosError('Could not fetch namespace list.', namespacesError));
    } else {
      this.fetchWorkloads(namespacesSelected, activeFilters, resetPagination);
    }
  }

  getDeploymentItems = (data: WorkloadNamespaceResponse): WorkloadListItem[] => {
    let workloadsItems: WorkloadListItem[] = [];
    if (data.workloads) {
      data.workloads.forEach(deployment => {
        workloadsItems.push({
          namespace: data.namespace.name,
          workload: deployment,
          healthPromise: API.getWorkloadHealth(
            authentication(),
            data.namespace.name,
            deployment.name,
            this.state.rateInterval
          )
        });
      });
    }
    return workloadsItems;
  };

  fetchWorkloads(namespaces: string[], filters: ActiveFilter[], resetPagination?: boolean) {
    const workloadsConfigPromises = namespaces.map(namespace => API.getWorkloads(authentication(), namespace));
    Promise.all(workloadsConfigPromises).then(responses => {
      const currentPage = resetPagination ? 1 : this.state.pagination.page;
      let workloadsItems: WorkloadListItem[] = [];
      responses.forEach(response => {
        workloadsItems = workloadsItems.concat(
          WorkloadListFilters.filterBy(this.getDeploymentItems(response.data), filters)
        );
      });
      WorkloadListFilters.sortWorkloadsItems(
        workloadsItems,
        this.state.currentSortField,
        this.state.isSortAscending
      ).then(sorted => {
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
      });
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
        <StatefulFilters
          initialFilters={WorkloadListFilters.availableFilters}
          pageHooks={this.props.pageHooks}
          onFilterChange={this.onFilterChange}
        >
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
}

export default WorkloadListComponent;
