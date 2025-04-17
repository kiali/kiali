import * as React from 'react';
import * as FilterHelper from '../../components/FilterList/FilterHelper';
import { RenderContent } from '../../components/Nav/Page';
import * as AppListFilters from './FiltersAndSorts';
import { DefaultSecondaryMasthead } from '../../components/DefaultSecondaryMasthead/DefaultSecondaryMasthead';
import * as FilterComponent from '../../components/FilterList/FilterComponent';
import { AppListItem } from '../../types/AppList';
import { DurationInSeconds, IntervalInMilliseconds, TimeInMilliseconds } from '../../types/Common';
import { Namespace } from '../../types/Namespace';
import { PromisesRegistry } from '../../utils/CancelablePromises';
import { KialiAppState } from '../../store/Store';
import { activeNamespacesSelector, durationSelector, refreshIntervalSelector } from '../../store/Selectors';
import { connect } from 'react-redux';
import { namespaceEquals } from '../../utils/Common';
import { SortField } from '../../types/SortFilters';
import { ActiveFiltersInfo, ActiveTogglesInfo } from '../../types/Filters';
import { FilterSelected, StatefulFilters, Toggles } from '../../components/Filters/StatefulFilters';
import * as API from '../../services/Api';
import * as AppListClass from './AppListClass';
import { VirtualList } from '../../components/VirtualList/VirtualList';
import { TimeDurationComponent } from '../../components/Time/TimeDurationComponent';
import { isMultiCluster, serverConfig } from '../../config';
import { RefreshIntervalManual, RefreshIntervalPause } from 'config/Config';
import { connectRefresh } from 'components/Refresh/connectRefresh';
import { EmptyVirtualList } from 'components/VirtualList/EmptyVirtualList';

type AppListPageState = FilterComponent.State<AppListItem> & {
  loaded: boolean;
};

type ReduxProps = {
  activeNamespaces: Namespace[];
  duration: DurationInSeconds;
  refreshInterval: IntervalInMilliseconds;
};

type AppListPageProps = ReduxProps & {
  lastRefreshAt: TimeInMilliseconds; // redux by way of ConnectRefresh
};

class AppListPageComponent extends FilterComponent.Component<AppListPageProps, AppListPageState, AppListItem> {
  private promises = new PromisesRegistry();
  private initialToggles = AppListFilters.getAvailableToggles();

  constructor(props: AppListPageProps) {
    super(props);
    const prevCurrentSortField = FilterHelper.currentSortField(AppListFilters.sortFields);
    const prevIsSortAscending = FilterHelper.isCurrentSortAscending();

    this.state = {
      currentSortField: prevCurrentSortField,
      isSortAscending: prevIsSortAscending,
      listItems: [],
      loaded: false
    };
  }

  componentDidMount(): void {
    if (this.props.refreshInterval !== RefreshIntervalManual) {
      this.updateListItems();
    }
  }

  componentDidUpdate(prevProps: AppListPageProps): void {
    const prevCurrentSortField = FilterHelper.currentSortField(AppListFilters.sortFields);
    const prevIsSortAscending = FilterHelper.isCurrentSortAscending();

    if (
      this.props.lastRefreshAt !== prevProps.lastRefreshAt ||
      (this.props.refreshInterval !== RefreshIntervalManual &&
        (!namespaceEquals(this.props.activeNamespaces, prevProps.activeNamespaces) ||
          this.props.duration !== prevProps.duration ||
          (this.props.refreshInterval !== prevProps.refreshInterval &&
            this.props.refreshInterval !== RefreshIntervalPause) ||
          this.state.currentSortField !== prevCurrentSortField ||
          this.state.isSortAscending !== prevIsSortAscending))
    ) {
      this.setState({
        currentSortField: prevCurrentSortField,
        isSortAscending: prevIsSortAscending
      });

      this.updateListItems();
    }
  }

  componentWillUnmount(): void {
    this.promises.cancelAll();
  }

  onSort = (): void => {
    // force list update on sorting
    this.setState({});
  };

  sortItemList(items: AppListItem[], sortField: SortField<AppListItem>, isAscending: boolean): AppListItem[] {
    // Chain promises, as there may be an ongoing fetch/refresh and sort can be called after UI interaction
    // This ensures that the list will display the new data with the right sorting
    return AppListFilters.sortAppsItems(items, sortField, isAscending);
  }

  updateListItems(): void {
    this.promises.cancelAll();
    const activeFilters: ActiveFiltersInfo = FilterSelected.getSelected();
    const activeToggles: ActiveTogglesInfo = Toggles.getToggles();
    const uniqueClusters = new Set<string>();

    Object.keys(serverConfig.clusters).forEach(cluster => {
      uniqueClusters.add(cluster);
    });

    if (this.props.activeNamespaces.length !== 0) {
      this.fetchApps(Array.from(uniqueClusters), activeFilters, activeToggles, this.props.duration);
    } else {
      this.setState({ listItems: [], loaded: true });
    }
  }

  fetchApps(clusters: string[], filters: ActiveFiltersInfo, toggles: ActiveTogglesInfo, rateInterval: number): void {
    const appsPromises = clusters.map(cluster => {
      const health = toggles.get('health') ? 'true' : 'false';
      const istioResources = toggles.get('istioResources') ? 'true' : 'false';

      return API.getClustersApps(
        this.props.activeNamespaces.map(ns => ns.name).join(','),
        {
          health: health,
          istioResources: istioResources,
          rateInterval: `${String(rateInterval)}s`
        },
        cluster
      );
    });

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
        this.setState({
          listItems: this.sortItemList(appListItems, this.state.currentSortField, this.state.isSortAscending),
          loaded: true
        });
      })
      .catch(err => {
        if (!err.isCanceled) {
          this.handleApiError('Could not fetch apps list', err);
        }
      });
  }

  render(): React.ReactNode {
    const hiddenColumns = isMultiCluster ? ([] as string[]) : ['cluster'];

    Toggles.getToggles().forEach((v, k) => {
      if (!v) {
        hiddenColumns.push(k);
      }
    });

    return (
      <>
        <DefaultSecondaryMasthead
          rightToolbar={
            <TimeDurationComponent key={'DurationDropdown'} id="app-list-duration-dropdown" disabled={false} />
          }
        />
        <EmptyVirtualList loaded={this.state.loaded} refreshInterval={this.props.refreshInterval}>
          <RenderContent>
            <VirtualList
              rows={this.state.listItems}
              hiddenColumns={hiddenColumns}
              sort={this.onSort}
              type="applications"
            >
              <StatefulFilters
                initialFilters={AppListFilters.availableFilters}
                initialToggles={this.initialToggles}
                onFilterChange={this.onFilterChange}
                onToggleChange={this.onFilterChange}
              />
            </VirtualList>
          </RenderContent>
        </EmptyVirtualList>
      </>
    );
  }
}

const mapStateToProps = (state: KialiAppState): ReduxProps => ({
  activeNamespaces: activeNamespacesSelector(state),
  duration: durationSelector(state),
  refreshInterval: refreshIntervalSelector(state)
});

export const AppListPage = connectRefresh(connect(mapStateToProps)(AppListPageComponent));
