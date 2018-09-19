import * as React from 'react';
import * as API from '../../services/Api';
import { authentication } from '../../utils/Authentication';
import Namespace from '../../types/Namespace';
import { AxiosError } from 'axios';
import { WorkloadListItem, WorkloadNamespaceResponse } from '../../types/Workload';
import { WorkloadListFilters } from './FiltersAndSorts';
import { FilterSelected, StatefulFilters } from '../../components/Filters/StatefulFilters';
import { NamespaceFilter } from '../../components/Filters/NamespaceFilter';
import { ListView, Sort, Paginator, ToolbarRightContent, Button, Icon } from 'patternfly-react';
import { Pagination } from '../../types/Pagination';
import { ActiveFilter, FilterType } from '../../types/Filters';
import { removeDuplicatesArray } from '../../utils/Common';
import { URLParameter } from '../../types/Parameters';
import ItemDescription from './ItemDescription';
import RateIntervalToolbarItem from '../ServiceList/RateIntervalToolbarItem';
import { ListPage } from '../../components/ListPage/ListPage';

const availableFilters: FilterType[] = [
  NamespaceFilter.create(),
  WorkloadListFilters.workloadNameFilter,
  WorkloadListFilters.workloadTypeFilter,
  WorkloadListFilters.istioSidecarFilter,
  WorkloadListFilters.appLabelFilter,
  WorkloadListFilters.versionLabelFilter
];

type WorkloadListComponentState = {
  workloadItems: WorkloadListItem[];
  pagination: Pagination;
  currentSortField: WorkloadListFilters.SortField;
  isSortAscending: boolean;
  rateInterval: number;
};

type WorkloadListComponentProps = {
  pagination: Pagination;
  pageHooks: ListPage.Hooks;
  currentSortField: WorkloadListFilters.SortField;
  isSortAscending: boolean;
  rateInterval: number;
};

class WorkloadListComponent extends React.Component<WorkloadListComponentProps, WorkloadListComponentState> {
  constructor(props: WorkloadListComponentProps) {
    super(props);
    this.state = {
      workloadItems: [],
      pagination: this.props.pagination,
      currentSortField: this.props.currentSortField,
      isSortAscending: this.props.isSortAscending,
      rateInterval: this.props.rateInterval
    };
  }

  componentDidMount() {
    this.updateWorkloads();
  }

  componentDidUpdate(prevProps: WorkloadListComponentProps, prevState: WorkloadListComponentState, snapshot: any) {
    if (!this.paramsAreSynced(prevProps)) {
      this.setState({
        pagination: this.props.pagination,
        currentSortField: this.props.currentSortField,
        isSortAscending: this.props.isSortAscending,
        rateInterval: this.props.rateInterval
      });

      this.updateWorkloads();
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

  updateWorkloads = (resetPagination?: boolean) => {
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
  };

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
            workloadItems: sorted,
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

  pageSet = (page: number) => {
    this.setState(prevState => {
      return {
        workloadItems: prevState.workloadItems,
        pagination: {
          page: page,
          perPage: prevState.pagination.perPage,
          perPageOptions: ListPage.perPageOptions
        }
      };
    });

    this.props.pageHooks.onParamChange([{ name: 'page', value: String(page) }]);
  };

  pageSelect = (perPage: number) => {
    this.setState(prevState => {
      return {
        workloadItems: prevState.workloadItems,
        pagination: {
          page: 1,
          perPage: perPage,
          perPageOptions: ListPage.perPageOptions
        }
      };
    });

    this.props.pageHooks.onParamChange([{ name: 'page', value: '1' }, { name: 'perPage', value: String(perPage) }]);
  };

  updateSortField = (sortField: WorkloadListFilters.SortField) => {
    WorkloadListFilters.sortWorkloadsItems(this.state.workloadItems, sortField, this.state.isSortAscending).then(
      sorted => {
        this.setState({
          currentSortField: sortField,
          workloadItems: sorted
        });
        this.props.pageHooks.onParamChange([{ name: 'sort', value: sortField.param }]);
      }
    );
  };

  updateSortDirection = () => {
    WorkloadListFilters.sortWorkloadsItems(
      this.state.workloadItems,
      this.state.currentSortField,
      !this.state.isSortAscending
    ).then(sorted => {
      this.setState({
        isSortAscending: !this.state.isSortAscending,
        workloadItems: sorted
      });
      this.props.pageHooks.onParamChange([{ name: 'direction', value: this.state.isSortAscending ? 'asc' : 'desc' }]);
    });
  };

  handleAxiosError(message: string, error: AxiosError) {
    const errMsg = API.getErrorMsg(message, error);
    console.error(errMsg);
  }

  updateParams(params: URLParameter[], id: string, value: string) {
    let newParams = params;
    const index = newParams.findIndex(param => param.name === id && param.value.length > 0);
    if (index >= 0) {
      newParams[index].value = value;
    } else {
      newParams.push({
        name: id,
        value: value
      });
    }
    return newParams;
  }

  onFilterChange = () => {
    // Resetting pagination when filters change
    this.props.pageHooks.onParamChange([{ name: 'page', value: '' }]);
    this.updateWorkloads(true);
  };

  handleError = (error: string) => {
    this.props.pageHooks.handleError(error);
  };

  render() {
    let workloadList: React.ReactElement<{}>[] = [];
    let pageStart = (this.state.pagination.page - 1) * this.state.pagination.perPage;
    let pageEnd = pageStart + this.state.pagination.perPage;
    pageEnd = pageEnd < this.state.workloadItems.length ? pageEnd : this.state.workloadItems.length;

    for (let i = pageStart; i < pageEnd; i++) {
      workloadList.push(
        <ItemDescription
          workloadItem={this.state.workloadItems[i]}
          key={`ItemDescription_${this.state.workloadItems[i].workload.name}_${i}`}
          position={i}
        />
      );
    }

    return (
      <>
        <StatefulFilters
          initialFilters={availableFilters}
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
            <Button onClick={this.updateWorkloads}>
              <Icon name="refresh" />
            </Button>
          </ToolbarRightContent>
        </StatefulFilters>
        <ListView>{workloadList}</ListView>
        <Paginator
          viewType="list"
          pagination={this.state.pagination}
          itemCount={this.state.workloadItems.length}
          onPageSet={this.pageSet}
          onPerPageSelect={this.pageSelect}
        />
      </>
    );
  }

  private rateIntervalChangedHandler = (key: number) => {
    this.setState({ rateInterval: key });
    this.props.pageHooks.onParamChange([{ name: 'rate', value: key.toString(10) }]);
    this.updateWorkloads();
  };
}

export default WorkloadListComponent;
