import * as React from 'react';
import * as API from '../../services/Api';
import { authentication } from '../../utils/Authentication';
import Namespace from '../../types/Namespace';
import { AppList, AppListItem } from '../../types/AppList';
import { AppListFilters } from './FiltersAndSorts';
import { AppListClass } from './AppListClass';
import { FilterSelected, StatefulFilters } from '../../components/Filters/StatefulFilters';
import { Button, Icon, ListView, Paginator, Sort, ToolbarRightContent } from 'patternfly-react';
import { ActiveFilter } from '../../types/Filters';
import { CancelablePromise, makeCancelablePromise, removeDuplicatesArray } from '../../utils/Common';
import RateIntervalToolbarItem from '../ServiceList/RateIntervalToolbarItem';
import { ListPage } from '../../components/ListPage/ListPage';
import { SortField } from '../../types/SortFilters';
import { ListComponent } from '../../components/ListPage/ListComponent';
import { HistoryManager, URLParams } from '../../app/History';

interface AppListComponentState extends ListComponent.State<AppListItem> {
  rateInterval: number;
}

interface AppListComponentProps extends ListComponent.Props<AppListItem> {
  rateInterval: number;
}

class AppListComponent extends ListComponent.Component<AppListComponentProps, AppListComponentState, AppListItem> {
  private nsPromise?: CancelablePromise<API.Response<Namespace[]>>;
  private appPromise?: CancelablePromise<API.Response<AppList>[]>;
  private sortPromise?: CancelablePromise<AppListItem[]>;

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
    this.cancelAsyncs();
  }

  paramsAreSynced(prevProps: AppListComponentProps) {
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

  sortItemList(apps: AppListItem[], sortField: SortField<AppListItem>, isAscending: boolean): Promise<AppListItem[]> {
    let lastSort: Promise<AppListItem[]>;
    const sorter = unsorted => {
      this.sortPromise = makeCancelablePromise(AppListFilters.sortAppsItems(unsorted, sortField, isAscending));
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
      // If there is no "sortPromise" set, take the received (unsorted) list of apps to sort
      // them and update the UI with the sorted list.
      lastSort = sorter(apps);
    } else {
      // If there is a "sortPromise", there may be an ongoing fetch/refresh. So, the received <apps> list argument
      // shoudn't be used as it may represent the "old" data before the refresh. Instead, append a callback to the
      // "sortPromise" to re-sort once the data is fetched. This ensures that the list will display the new data with
      // the right sorting.
      // (See other comments in the fetchApps method)
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
          this.fetchApps(
            namespaces.map(namespace => namespace.name),
            activeFilters,
            this.props.rateInterval,
            resetPagination
          );
          this.nsPromise = undefined;
        })
        .catch(namespacesError => {
          if (!namespacesError.isCanceled) {
            this.handleAxiosError('Could not fetch namespace list.', namespacesError);
          }
        });
    } else {
      this.fetchApps(namespacesSelected, activeFilters, this.props.rateInterval, resetPagination);
    }
  }

  fetchApps(namespaces: string[], filters: ActiveFilter[], rateInterval: number, resetPagination?: boolean) {
    const appsPromises = namespaces.map(namespace => API.getApps(authentication(), namespace));
    this.appPromise = makeCancelablePromise(Promise.all(appsPromises));
    this.appPromise.promise
      .then(responses => {
        const currentPage = resetPagination ? 1 : this.state.pagination.page;

        let appListItems: AppListItem[] = [];
        responses.forEach(response => {
          AppListFilters.filterBy(response.data, filters);
          appListItems = appListItems.concat(AppListClass.getAppItems(response.data, rateInterval));
        });
        if (this.sortPromise) {
          this.sortPromise.cancel();
        }
        // Promises for sorting are needed, because the user may have the list sorted using health/error rates
        // and these data can be fetched only after the list is retrieved. If the user is sorting using these
        // criteria, the update of the list is deferred after sorting is possible. This way, it's avoided the
        // illusion of double-fetch or flickering list.
        this.sortPromise = makeCancelablePromise(
          AppListFilters.sortAppsItems(appListItems, this.state.currentSortField, this.state.isSortAscending)
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
        this.appPromise = undefined;
      })
      .catch(err => {
        if (!err.isCanceled) {
          console.debug(err);
        }
      });
  }

  render() {
    let appItemsList: React.ReactElement<{}>[] = [];
    let pageStart = (this.state.pagination.page - 1) * this.state.pagination.perPage;
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

  private cancelAsyncs = () => {
    if (this.nsPromise) {
      this.nsPromise.cancel();
      this.nsPromise = undefined;
    }
    if (this.appPromise) {
      this.appPromise.cancel();
      this.appPromise = undefined;
    }
    if (this.sortPromise) {
      this.sortPromise.cancel();
      this.sortPromise = undefined;
    }
  };
}

export default AppListComponent;
