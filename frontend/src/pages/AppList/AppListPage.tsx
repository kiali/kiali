import * as React from 'react';
import * as FilterHelper from '../../components/FilterList/FilterHelper';
import { RenderContent } from '../../components/Nav/Page';
import * as AppListFilters from './FiltersAndSorts';
import { DefaultSecondaryMasthead } from '../../components/DefaultSecondaryMasthead/DefaultSecondaryMasthead';
import * as FilterComponent from '../../components/FilterList/FilterComponent';
import type { AppListItem } from '../../types/AppList';
import type { IntervalInMilliseconds, TimeInMilliseconds } from '../../types/Common';
import type { Namespace } from '../../types/Namespace';
import { PromisesRegistry } from '../../utils/CancelablePromises';
import type { KialiAppState } from '../../store/Store';
import { activeNamespacesSelector, refreshIntervalSelector } from '../../store/Selectors';
import { connect } from 'react-redux';
import { namespaceEquals } from '../../utils/Common';
import type { SortField } from '../../types/SortFilters';
import type { ActiveFiltersInfo, ActiveTogglesInfo } from '../../types/Filters';
import { FilterSelected, StatefulFilters, Toggles } from '../../components/Filters/StatefulFilters';
import * as API from '../../services/Api';
import { addError } from '../../utils/AlertUtils';
import * as AppListClass from './AppListClass';
import { VirtualList } from '../../components/VirtualList/VirtualList';
import { Refresh } from '../../components/Refresh/Refresh';
import { HealthComputeDurationMastheadToolbar } from 'components/Time/HealthComputeDurationMastheadToolbar';
import { isMultiCluster, serverConfig } from '../../config';
import { RefreshIntervalManual, RefreshIntervalPause } from 'config/Config';
import { connectRefresh } from 'components/Refresh/connectRefresh';
import { HistoryManager } from 'app/History';
import { startPerfTimer, endPerfTimer } from '../../utils/PerformanceUtils';
import { kialiStyle } from 'styles/StyleUtils';
import { ManagedListColumnsModal } from '../../components/Filters/ManagedListColumnsModal';
import { applicationsListColumnsPreset } from '../../hooks/useManagedListColumns';
import type { KialiDispatch } from 'types/Redux';
import type { StatefulFiltersRef } from '../../components/Filters/StatefulFilters';

const refreshStyle = kialiStyle({
  marginLeft: '0.4rem',
  marginRight: '0.4rem'
});

type AppListPageState = FilterComponent.State<AppListItem> & {
  loaded: boolean;
  showColumnManagement: boolean;
};

type ReduxProps = {
  activeNamespaces: Namespace[];
  columnOrder: string[];
  hiddenColumnIds: string[];
  refreshInterval: IntervalInMilliseconds;
};

type ReduxDispatchProps = {
  dispatch: KialiDispatch;
};

type AppListPageProps = ReduxProps &
  ReduxDispatchProps & {
    lastRefreshAt: TimeInMilliseconds; // redux by way of ConnectRefresh
  };

class AppListPageComponent extends FilterComponent.Component<AppListPageProps, AppListPageState, AppListItem> {
  private sFStatefulFilters: StatefulFiltersRef = React.createRef();
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
      loaded: false,
      showColumnManagement: false
    };
  }

  componentDidMount(): void {
    if (this.props.refreshInterval !== RefreshIntervalManual && HistoryManager.getRefresh() !== RefreshIntervalManual) {
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
          (this.props.refreshInterval !== prevProps.refreshInterval &&
            (this.props.refreshInterval !== RefreshIntervalPause ||
              prevProps.refreshInterval === RefreshIntervalManual)) ||
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
      this.fetchApps(Array.from(uniqueClusters), activeFilters, activeToggles);
    } else {
      this.setState({ listItems: [], loaded: true });
    }
  }

  fetchApps(clusters: string[], filters: ActiveFiltersInfo, toggles: ActiveTogglesInfo): void {
    const perfKey = 'ClustersApps';
    const appsPromises = clusters.map(cluster => {
      const health = toggles.get('health') ? 'true' : 'false';
      const istioResources = toggles.get('istioResources') ? 'true' : 'false';
      startPerfTimer(perfKey);
      return API.getClusterApps(
        this.props.activeNamespaces.map(ns => ns.name).join(','),
        {
          health: health,
          istioResources: istioResources
        },
        cluster
      );
    });

    this.promises
      .registerAll('apps', appsPromises)
      .then(responses => {
        let appListItems: AppListItem[] = [];

        responses.forEach(response => {
          endPerfTimer(perfKey);
          appListItems = appListItems.concat(AppListClass.getAppItems(response.data));
        });

        return AppListFilters.filterBy(appListItems, filters);
      })
      .then(appListItems => {
        const sortedAppListItems = this.sortItemList(
          appListItems,
          this.state.currentSortField,
          this.state.isSortAscending
        );
        this.setState({
          listItems: sortedAppListItems,
          loaded: true
        });
      })
      .catch(err => {
        if (!err.isCanceled) {
          addError('Could not fetch apps list', err);
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

    const userHidden = this.props.hiddenColumnIds;
    const allHiddenColumns = hiddenColumns.concat(userHidden);

    return (
      <>
        <DefaultSecondaryMasthead
          rightToolbar={
            <HealthComputeDurationMastheadToolbar>
              <Refresh className={refreshStyle} id="app-list-refresh" disabled={false} manageURL={true} />
            </HealthComputeDurationMastheadToolbar>
          }
        />
        <RenderContent>
          <VirtualList
            loaded={this.state.loaded}
            refreshInterval={this.props.refreshInterval}
            rows={this.state.listItems}
            columnOrder={this.props.columnOrder}
            hiddenColumns={allHiddenColumns}
            sort={this.onSort}
            statefulProps={this.sFStatefulFilters}
            type="applications"
          >
            <StatefulFilters
              columnManagement={true}
              columnManagementButtonTestId="apps-manage-columns"
              initialFilters={AppListFilters.availableFilters}
              initialToggles={this.initialToggles}
              onColumnManagementClick={() => this.setState({ showColumnManagement: true })}
              onFilterChange={this.onFilterChange}
              onToggleChange={this.onFilterChange}
              ref={this.sFStatefulFilters}
            />
          </VirtualList>
        </RenderContent>

        <ManagedListColumnsModal
          {...applicationsListColumnsPreset}
          columnOrder={this.props.columnOrder}
          dispatch={this.props.dispatch}
          hiddenColumnIds={this.props.hiddenColumnIds}
          isOpen={this.state.showColumnManagement}
          onClose={() => this.setState({ showColumnManagement: false })}
        />
      </>
    );
  }
}

const mapStateToProps = (state: KialiAppState): ReduxProps => ({
  activeNamespaces: activeNamespacesSelector(state),
  columnOrder: state.appsList.columnOrder,
  hiddenColumnIds: state.appsList.hiddenColumnIds,
  refreshInterval: refreshIntervalSelector(state)
});

export const AppListPage = connectRefresh(connect(mapStateToProps)(AppListPageComponent));
