import * as React from 'react';
import * as API from '../../services/Api';
import { authentication } from '../../utils/Authentication';
import Namespace from '../../types/Namespace';
import { AppListItem } from '../../types/AppList';
import { AppListFilters } from './FiltersAndSorts';
import { AppListClass } from './AppListClass';
import { FilterSelected, StatefulFilters } from '../../components/Filters/StatefulFilters';
import { Button, Icon, ListView, Paginator, Sort, ToolbarRightContent } from 'patternfly-react';
import { ActiveFilter } from '../../types/Filters';
import { removeDuplicatesArray } from '../../utils/Common';
import RateIntervalToolbarItem from '../ServiceList/RateIntervalToolbarItem';
import { ListPage } from '../../components/ListPage/ListPage';
import { SortField } from '../../types/SortFilters';
import { ListComponent } from '../../components/ListPage/ListComponent';

interface AppListComponentState extends ListComponent.State<AppListItem> {
  rateInterval: number;
}

interface AppListComponentProps extends ListComponent.Props<AppListItem> {
  rateInterval: number;
}

class AppListComponent extends ListComponent.Component<AppListComponentProps, AppListComponentState, AppListItem> {
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
    this.setState({ rateInterval: key });
    this.props.pageHooks.onParamChange([{ name: 'rate', value: String(key) }]);
    this.updateListItems();
  };

  sortItemList(apps: AppListItem[], sortField: SortField<AppListItem>, isAscending: boolean) {
    return AppListFilters.sortAppsItems(apps, sortField, isAscending);
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
  }

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
              listItems: sorted,
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
        <StatefulFilters
          initialFilters={AppListFilters.availableFilters}
          pageHooks={this.props.pageHooks}
          onFilterChange={this.onFilterChange}
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
