import * as React from 'react';
import * as API from '../../services/Api';
import { authentication } from '../../utils/Authentication';
import Namespace from '../../types/Namespace';
import { AxiosError } from 'axios';
import { WorkloadListItem, WorkloadNamespaceResponse } from '../../types/Workload';
import { WorkloadListFilters } from './FiltersAndSorts';
import {
  defaultNamespaceFilter,
  NamespaceFilter,
  NamespaceFilterSelected
} from '../../components/NamespaceFilter/NamespaceFilter';
import { ListView, Sort, Paginator, ToolbarRightContent, Button, Icon } from 'patternfly-react';
import { Pagination } from '../../types/Pagination';
import { ActiveFilter, FILTER_ACTION_UPDATE, FilterType } from '../../types/NamespaceFilter';
import { removeDuplicatesArray } from '../../utils/Common';
import { URLParameter } from '../../types/Parameters';
import ItemDescription from './ItemDescription';
import RateIntervalToolbarItem from '../ServiceList/RateIntervalToolbarItem';
import { ListPage } from '../../components/ListPage/ListPage';

const availableFilters: FilterType[] = [
  defaultNamespaceFilter,
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
    this.setActiveFiltersToURL();
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

      NamespaceFilterSelected.setSelected(this.selectedFilters());
      this.updateWorkloads();
    }
  }

  paramsAreSynced(prevProps: WorkloadListComponentProps) {
    return (
      prevProps.pagination.page === this.props.pagination.page &&
      prevProps.pagination.perPage === this.props.pagination.perPage &&
      prevProps.rateInterval === this.props.rateInterval &&
      prevProps.isSortAscending === this.props.isSortAscending &&
      prevProps.currentSortField.title === this.props.currentSortField.title &&
      this.filtersMatch()
    );
  }

  filtersMatch() {
    const selectedFilters: Map<string, string[]> = new Map<string, string[]>();

    NamespaceFilterSelected.getSelected().map(activeFilter => {
      const existingValue = selectedFilters.get(activeFilter.category) || [];
      selectedFilters.set(activeFilter.category, existingValue.concat(activeFilter.value));
    });

    let urlParams: Map<string, string[]> = new Map<string, string[]>();
    availableFilters.forEach(filter => {
      const param = this.props.pageHooks.getQueryParam(filter.id);
      if (param !== undefined) {
        const existing = urlParams.get(filter.title) || [];
        urlParams.set(filter.title, existing.concat(param));
      }
    });

    let equalFilters = true;
    selectedFilters.forEach((filterValues, filterName) => {
      const aux = urlParams.get(filterName) || [];
      equalFilters =
        equalFilters && filterValues.every(value => aux.includes(value)) && filterValues.length === aux.length;
    });

    return selectedFilters.size === urlParams.size && equalFilters;
  }

  updateWorkloads = (resetPagination?: boolean) => {
    const activeFilters: ActiveFilter[] = NamespaceFilterSelected.getSelected();
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

  setActiveFiltersToURL() {
    const params = NamespaceFilterSelected.getSelected()
      .map(activeFilter => {
        const availableFilter = availableFilters.find(filter => {
          return filter.title === activeFilter.category;
        });

        if (typeof availableFilter === 'undefined') {
          NamespaceFilterSelected.setSelected(
            NamespaceFilterSelected.getSelected().filter(nfs => {
              return nfs.category !== activeFilter.category;
            })
          );
          return null;
        }

        return {
          name: availableFilter.id,
          value: activeFilter.value
        };
      })
      .filter(filter => filter !== null) as URLParameter[];

    this.props.pageHooks.onParamChange(params, 'append', 'replace');
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
            workloadItems: sorted,
            pagination: {
              page: currentPage,
              perPage: prevState.pagination.perPage
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
          perPage: prevState.pagination.perPage
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
          perPage: perPage
        }
      };
    });

    this.props.pageHooks.onParamChange([{ name: 'page', value: '1' }, { name: 'perPage', value: String(perPage) }]);
  };

  selectedFilters() {
    let activeFilters: ActiveFilter[] = [];
    availableFilters.forEach(filter => {
      (this.props.pageHooks.getQueryParam(filter.id) || []).forEach(value => {
        activeFilters.push({
          label: filter.title + ': ' + value,
          category: filter.title,
          value: value
        });
      });
    });

    return activeFilters;
  }

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

  onFilterChange = (filters: ActiveFilter[]) => {
    let params: URLParameter[] = [];

    availableFilters.forEach(availableFilter => {
      params.push({ name: availableFilter.id, value: '' });
    });

    filters.forEach(activeFilter => {
      let filterId = (
        availableFilters.find(filter => {
          return filter.title === activeFilter.category;
        }) || availableFilters[2]
      ).id;

      const updateableFilterIds = availableFilters
        .filter(filter => filter.action === FILTER_ACTION_UPDATE)
        .map(filter => filter.id);

      if (updateableFilterIds.includes(filterId)) {
        params = this.updateParams(params, filterId, activeFilter.value);
      } else {
        params.push({
          name: filterId,
          value: activeFilter.value
        });
      }
    });

    // Resetting pagination when filters change
    params.push({ name: 'page', value: '' });

    this.props.pageHooks.onParamChange(params, 'append');
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
        <NamespaceFilter
          initialFilters={[
            WorkloadListFilters.workloadNameFilter,
            WorkloadListFilters.workloadTypeFilter,
            WorkloadListFilters.istioSidecarFilter,
            WorkloadListFilters.appLabelFilter,
            WorkloadListFilters.versionLabelFilter
          ]}
          initialActiveFilters={this.selectedFilters()}
          onFilterChange={this.onFilterChange}
          onError={this.handleError}
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
        </NamespaceFilter>
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
