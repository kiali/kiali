import * as React from 'react';
import * as API from '../../services/Api';
import { authentication } from '../../utils/Authentication';
import Namespace from '../../types/Namespace';
import { AxiosError } from 'axios';
import { AppListItem } from '../../types/AppList';
import { AppListFilters } from './FiltersAndSorts';
import { AppListClass } from './AppListClass';
import { FilterSelected, StatefulFilters } from '../../components/Filters/StatefulFilters';
import { NamespaceFilter } from '../../components/Filters/NamespaceFilter';
import { ListView, Sort, Paginator, ToolbarRightContent, Button, Icon } from 'patternfly-react';
import { Pagination } from '../../types/Pagination';
import { ActiveFilter, FilterType } from '../../types/Filters';
import { removeDuplicatesArray } from '../../utils/Common';
import { URLParameter } from '../../types/Parameters';
import RateIntervalToolbarItem from '../ServiceList/RateIntervalToolbarItem';
import { ListPage } from '../../components/ListPage/ListPage';

const availableFilters: FilterType[] = [
  NamespaceFilter.create(),
  AppListFilters.appNameFilter,
  AppListFilters.istioSidecarFilter
];

type AppListComponentState = {
  appListItems: AppListItem[];
  pagination: Pagination;
  currentSortField: AppListFilters.SortField;
  isSortAscending: boolean;
  rateInterval: number;
};

type AppListComponentProps = {
  pagination: Pagination;
  pageHooks: ListPage.Hooks;
  currentSortField: AppListFilters.SortField;
  isSortAscending: boolean;
  rateInterval: number;
};

class AppListComponent extends React.Component<AppListComponentProps, AppListComponentState> {
  constructor(props: AppListComponentProps) {
    super(props);
    this.state = {
      appListItems: [],
      pagination: this.props.pagination,
      currentSortField: this.props.currentSortField,
      isSortAscending: this.props.isSortAscending,
      rateInterval: this.props.rateInterval
    };
    this.props.pageHooks.setSelectedFiltersToURL(availableFilters);
  }

  componentDidMount() {
    this.updateApps();
  }

  updateApps = (resetPagination?: boolean) => {
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
          this.fetchApps(
            namespaces.map(namespace => namespace.name),
            activeFilters,
            this.props.rateInterval,
            resetPagination
          );
        })
        .catch(namespacesError => this.handleAxiosError('Could not fetch namespace list.', namespacesError));
    } else {
      this.fetchApps(namespacesSelected, activeFilters, this.props.rateInterval, resetPagination);
    }
  };

  fetchApps(namespaces: string[], filters: ActiveFilter[], rateInterval: number, resetPagination?: boolean) {
    const appsPromises = namespaces.map(namespace => API.getApps(authentication(), namespace));
    Promise.all(appsPromises).then(responses => {
      const currentPage = resetPagination ? 1 : this.state.pagination.page;

      let appListItems: AppListItem[] = [];
      responses.forEach(response => {
        appListItems = appListItems.concat(
          AppListFilters.filterBy(AppListClass.getAppItems(response.data, rateInterval), filters)
        );
      });

      AppListFilters.sortAppsItems(appListItems, this.state.currentSortField, this.state.isSortAscending).then(
        sorted => {
          this.setState(prevState => {
            return {
              appListItems: sorted,
              pagination: {
                page: currentPage,
                perPage: prevState.pagination.perPage,
                perPageOptions: ListPage.perPageOptions
              }
            };
          });
        }
      );
    });
  }

  componentDidUpdate(prevProps: AppListComponentProps, prevState: AppListComponentState, snapshot: any) {
    if (!this.paramsAreSynced(prevProps)) {
      this.setState({
        pagination: this.props.pagination,
        currentSortField: this.props.currentSortField,
        isSortAscending: this.props.isSortAscending,
        rateInterval: this.props.rateInterval
      });

      this.props.pageHooks.setSelectedFiltersFromURL(availableFilters);
      this.updateApps();
    }
  }

  paramsAreSynced(prevProps: AppListComponentProps) {
    return (
      prevProps.pagination.page === this.props.pagination.page &&
      prevProps.pagination.perPage === this.props.pagination.perPage &&
      prevProps.rateInterval === this.props.rateInterval &&
      prevProps.isSortAscending === this.props.isSortAscending &&
      prevProps.currentSortField.title === this.props.currentSortField.title &&
      this.props.pageHooks.filtersMatchURL(availableFilters)
    );
  }

  pageSet = (page: number) => {
    this.setState(prevState => {
      return {
        appListItems: prevState.appListItems,
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
        appListItems: prevState.appListItems,
        pagination: {
          page: 1,
          perPage: perPage,
          perPageOptions: ListPage.perPageOptions
        }
      };
    });

    this.props.pageHooks.onParamChange([{ name: 'page', value: '1' }, { name: 'perPage', value: String(perPage) }]);
  };

  updateSortField = (sortField: AppListFilters.SortField) => {
    AppListFilters.sortAppsItems(this.state.appListItems, sortField, this.state.isSortAscending).then(sorted => {
      this.setState({
        currentSortField: sortField,
        appListItems: sorted
      });
      this.props.pageHooks.onParamChange([{ name: 'sort', value: sortField.param }]);
    });
  };

  updateSortDirection = () => {
    AppListFilters.sortAppsItems(
      this.state.appListItems,
      this.state.currentSortField,
      !this.state.isSortAscending
    ).then(sorted => {
      this.setState({
        isSortAscending: !this.state.isSortAscending,
        appListItems: sorted
      });
      this.props.pageHooks.onParamChange([{ name: 'direction', value: this.state.isSortAscending ? 'asc' : 'desc' }]);
    });
  };

  handleAxiosError(message: string, error: AxiosError) {
    const errMsg = API.getErrorMsg(message, error);
    console.error(errMsg);
  }

  updateParams(params: URLParameter[], looking: string, id: string, value: string) {
    let newParams = params;
    const index = newParams.findIndex(param => param.name === looking && param.value.length > 0);
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
      switch (activeFilter.category) {
        case 'Istio Sidecar': {
          params = this.updateParams(params, 'istiosidecar', filterId, activeFilter.value);
          break;
        }
        default: {
          params.push({
            name: filterId,
            value: activeFilter.value
          });
        }
      }
    });

    // Resetting pagination when filters change
    params.push({ name: 'page', value: '' });

    this.props.pageHooks.onParamChange(params, 'append');
    this.updateApps(true);
  };

  handleError = (error: string) => {
    this.props.pageHooks.handleError(error);
  };

  render() {
    let appItemsList: React.ReactElement<{}>[] = [];
    let pageStart = (this.state.pagination.page - 1) * this.state.pagination.perPage;
    let pageEnd = pageStart + this.state.pagination.perPage;
    pageEnd = pageEnd < this.state.appListItems.length ? pageEnd : this.state.appListItems.length;

    for (let i = pageStart; i < pageEnd; i++) {
      appItemsList.push(AppListClass.renderAppListItem(this.state.appListItems[i], i));
    }

    return (
      <>
        <StatefulFilters
          initialFilters={availableFilters}
          initialActiveFilters={FilterSelected.getSelected()}
          onFilterChange={this.onFilterChange}
          onError={this.handleError}
        >
          <Sort>
            <Sort.TypeSelector
              sortTypes={AppListFilters.sortFields}
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
            <Button onClick={this.updateApps}>
              <Icon name="refresh" />
            </Button>
          </ToolbarRightContent>
        </StatefulFilters>
        <ListView>{appItemsList}</ListView>
        <Paginator
          viewType="list"
          pagination={this.state.pagination}
          itemCount={this.state.appListItems.length}
          onPageSet={this.pageSet}
          onPerPageSelect={this.pageSelect}
        />
      </>
    );
  }

  private rateIntervalChangedHandler = (key: number) => {
    this.setState({ rateInterval: key });
    this.props.pageHooks.onParamChange([{ name: 'rate', value: key.toString(10) }]);
    this.updateApps();
  };
}

export default AppListComponent;
