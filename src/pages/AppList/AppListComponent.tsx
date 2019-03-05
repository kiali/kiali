import * as React from 'react';
import * as API from '../../services/Api';
import Namespace from '../../types/Namespace';
import { AppListItem } from '../../types/AppList';
import { AppListFilters } from './FiltersAndSorts';
import { AppListClass } from './AppListClass';
import { FilterSelected, StatefulFilters } from '../../components/Filters/StatefulFilters';
import { Button, Icon, ListView, Paginator, Sort, ToolbarRightContent } from 'patternfly-react';
import { ActiveFilter } from '../../types/Filters';
import { PromisesRegistry } from '../../utils/CancelablePromises';
import { ListPagesHelper } from '../../components/ListPage/ListPagesHelper';
import { SortField } from '../../types/SortFilters';
import { ListComponent } from '../../components/ListPage/ListComponent';
import { HistoryManager, URLParams } from '../../app/History';

interface AppListComponentState extends ListComponent.State<AppListItem> {
  rateInterval: number;
}

interface AppListComponentProps extends ListComponent.Props<AppListItem> {
  rateInterval: number;
  activeNamespaces: Namespace[];
}

class AppListComponent extends ListComponent.Component<AppListComponentProps, AppListComponentState, AppListItem> {
  private promises = new PromisesRegistry();

  constructor(props: AppListComponentProps) {
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

  componentDidUpdate(prevProps: AppListComponentProps, prevState: AppListComponentState, snapshot: any) {
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

  paramsAreSynced(prevProps: AppListComponentProps) {
    return (
      prevProps.pagination.page === this.props.pagination.page &&
      prevProps.pagination.perPage === this.props.pagination.perPage &&
      prevProps.rateInterval === this.props.rateInterval &&
      prevProps.activeNamespaces === this.props.activeNamespaces &&
      prevProps.isSortAscending === this.props.isSortAscending &&
      prevProps.currentSortField.title === this.props.currentSortField.title
    );
  }

  rateIntervalChangedHandler = (key: number) => {
    HistoryManager.setParam(URLParams.DURATION, String(key));
    this.setState({ rateInterval: key });
  };

  sortItemList(apps: AppListItem[], sortField: SortField<AppListItem>, isAscending: boolean): Promise<AppListItem[]> {
    // Chain promises, as there may be an ongoing fetch/refresh and sort can be called after UI interaction
    // This ensures that the list will display the new data with the right sorting
    return this.promises.registerChained('sort', apps, unsorted =>
      AppListFilters.sortAppsItems(unsorted, sortField, isAscending)
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
          const namespaces: Namespace[] = namespacesResponse['data'];
          this.fetchApps(
            namespaces.map(namespace => namespace.name),
            activeFilters,
            this.props.rateInterval,
            resetPagination
          );
        })
        .catch(namespacesError => {
          if (!namespacesError.isCanceled) {
            this.handleAxiosError('Could not fetch namespace list', namespacesError);
          }
        });
    } else {
      this.fetchApps(namespacesSelected, activeFilters, this.props.rateInterval, resetPagination);
    }
  }

  fetchApps(namespaces: string[], filters: ActiveFilter[], rateInterval: number, resetPagination?: boolean) {
    const appsPromises = namespaces.map(namespace => API.getApps(namespace));
    this.promises
      .registerAll('apps', appsPromises)
      .then(responses => {
        let appListItems: AppListItem[] = [];
        responses.forEach(response => {
          appListItems = appListItems.concat(AppListClass.getAppItems(response.data, rateInterval));
        });
        return AppListFilters.filterBy(appListItems, filters);
      })
      .then(appListItems => {
        const currentPage = resetPagination ? 1 : this.state.pagination.page;
        this.promises.cancel('sort');
        this.sortItemList(appListItems, this.state.currentSortField, this.state.isSortAscending)
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
          this.handleAxiosError('Could not fetch apps list', err);
        }
      });
  }

  render() {
    const appItemsList: React.ReactElement<{}>[] = [];
    const pageStart = (this.state.pagination.page - 1) * this.state.pagination.perPage;
    let pageEnd = pageStart + this.state.pagination.perPage;
    pageEnd = pageEnd < this.state.listItems.length ? pageEnd : this.state.listItems.length;

    for (let i = pageStart; i < pageEnd; i++) {
      appItemsList.push(AppListClass.renderAppListItem(this.state.listItems[i], i));
    }

    return (
      <>
        <StatefulFilters initialFilters={AppListFilters.availableFilters} onFilterChange={this.onFilterChange}>
          <Sort>
            <Sort.TypeSelector
              sortTypes={AppListFilters.sortFields}
              currentSortType={this.state.currentSortField}
              onSortTypeSelected={this.updateSortField}
            />
            <Sort.DirectionSelector
              isNumeric={this.state.currentSortField.isNumeric}
              isAscending={this.state.isSortAscending}
              onClick={this.updateSortDirection}
            />
          </Sort>
          <ToolbarRightContent>
            <Button onClick={this.updateListItems}>
              <Icon name="refresh" />
            </Button>
          </ToolbarRightContent>
        </StatefulFilters>
        <ListView>{appItemsList}</ListView>
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

export default AppListComponent;
