import * as React from 'react';
import * as FilterHelper from '../../components/FilterList/FilterHelper';
import { RenderContent } from '../../components/Nav/Page';
import * as AppListFilters from './FiltersAndSorts';
import { DefaultSecondaryMasthead } from '../../components/DefaultSecondaryMasthead/DefaultSecondaryMasthead';
import * as FilterComponent from '../../components/FilterList/FilterComponent';
import { AppListItem } from '../../types/AppList';
import { IntervalInMilliseconds, TimeInMilliseconds } from '../../types/Common';
import { Namespace } from '../../types/Namespace';
import { PromisesRegistry } from '../../utils/CancelablePromises';
import { KialiAppState } from '../../store/Store';
import { activeNamespacesSelector, refreshIntervalSelector } from '../../store/Selectors';
import { connect } from 'react-redux';
import { namespaceEquals } from '../../utils/Common';
import { SortField } from '../../types/SortFilters';
import { ActiveFiltersInfo, ActiveTogglesInfo } from '../../types/Filters';
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
import { HistoryManager, URLParam } from 'app/History';
import { startPerfTimer, endPerfTimer } from '../../utils/PerformanceUtils';
import { kialiStyle } from 'styles/StyleUtils';
import { arrayEquals } from '../../utils/Common';
import {
  ColumnManagementModalColumn,
  ListColumnManagementModal
} from '../../components/Filters/ListColumnManagementModal';
import { ManagedColumn } from '../../components/VirtualList/ManagedColumnTypes';
import { AppsListActions } from '../../actions/AppsListActions';
import { config as virtualListConfig } from '../../components/VirtualList/Config';
import { t } from 'utils/I18nUtils';
import { KialiDispatch } from 'types/Redux';
import { StatefulFiltersRef } from '../../components/Filters/StatefulFilters';

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
    this.syncColumnsFromURL();
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

  private syncColumnsFromURL = (): void => {
    const defaultIds = this.getDefaultManagedColumns().map(c => c.id);
    const validIds = defaultIds.filter(id => id !== 'app');

    const urlParam = HistoryManager.getParam(URLParam.APPS_HIDDEN_COLUMNS);
    if (urlParam !== undefined) {
      const ids = urlParam
        .split(',')
        .map(s => s.trim().toLowerCase())
        .filter(Boolean);
      const filtered = ids.filter(id => validIds.includes(id));
      if (filtered.length > 0 && !arrayEquals(filtered, this.props.hiddenColumnIds, (a, b) => a === b)) {
        this.props.dispatch(AppsListActions.setHiddenColumns(filtered));
      } else if (filtered.length === 0 && this.props.hiddenColumnIds.length > 0) {
        this.props.dispatch(AppsListActions.setHiddenColumns([]));
      }
    } else if (this.props.hiddenColumnIds.length > 0) {
      HistoryManager.setParam(URLParam.APPS_HIDDEN_COLUMNS, this.props.hiddenColumnIds.join(','));
    }

    const orderParam = HistoryManager.getParam(URLParam.APPS_COLUMN_ORDER);
    if (orderParam !== undefined) {
      const orderIds = orderParam
        .split(',')
        .map(s => s.trim().toLowerCase())
        .filter(Boolean);
      const validOrder = orderIds.filter(id => defaultIds.includes(id));
      if (validOrder.length > 0 && !arrayEquals(validOrder, this.props.columnOrder, (a, b) => a === b)) {
        this.props.dispatch(AppsListActions.setColumnOrder(validOrder));
      } else if (validOrder.length === 0 && this.props.columnOrder.length > 0) {
        this.props.dispatch(AppsListActions.setColumnOrder([]));
      }
    } else if (this.props.columnOrder.length > 0) {
      HistoryManager.setParam(URLParam.APPS_COLUMN_ORDER, this.props.columnOrder.join(','));
    }
  };

  private getDefaultManagedColumns = (): ManagedColumn[] => {
    return virtualListConfig.applications.columns
      .filter(c => c.title && c.title.trim().length > 0)
      .map(c => {
        const id = (c.id ?? c.name.toLowerCase()).toLowerCase();
        return {
          id,
          title: c.title,
          isShown: true,
          isDisabled: id === 'app'
        } as ManagedColumn;
      });
  };

  private getManagedColumns = (): ManagedColumn[] => {
    const defaultCols = this.getDefaultManagedColumns();
    const hiddenSet = new Set(this.props.hiddenColumnIds);
    let ordered = defaultCols;
    if (this.props.columnOrder && this.props.columnOrder.length > 0) {
      const orderMap = new Map(this.props.columnOrder.map((id, i) => [id, i]));
      ordered = [...defaultCols].sort((a, b) => {
        const ai = orderMap.get(a.id) ?? Number.MAX_SAFE_INTEGER;
        const bi = orderMap.get(b.id) ?? Number.MAX_SAFE_INTEGER;
        return ai - bi;
      });
    }
    return ordered.map(c => ({
      ...c,
      isShown: !hiddenSet.has(c.id)
    }));
  };

  private resetAppsColumnsToDefault = (): void => {
    this.props.dispatch(AppsListActions.setColumnOrder([]));
    this.props.dispatch(AppsListActions.setHiddenColumns([]));
    HistoryManager.deleteParam(URLParam.APPS_COLUMN_ORDER);
    HistoryManager.deleteParam(URLParam.APPS_HIDDEN_COLUMNS);
  };

  private getAppliedColumnsForModal = (): ColumnManagementModalColumn[] => {
    return this.getManagedColumns().map(c => ({
      key: c.id,
      title: c.title,
      isShownByDefault: true,
      isShown: c.isShown,
      isUntoggleable: c.id === 'app'
    }));
  };

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

        <ListColumnManagementModal
          appliedColumns={this.getAppliedColumnsForModal()}
          applyColumns={newColumns => {
            const hiddenIds = newColumns.filter(c => !c.isShown).map(c => c.key);
            const orderedIds = newColumns.map(c => c.key);
            this.props.dispatch(AppsListActions.setColumnOrder(orderedIds));
            if (orderedIds.length > 0) {
              HistoryManager.setParam(URLParam.APPS_COLUMN_ORDER, orderedIds.join(','));
            } else {
              HistoryManager.deleteParam(URLParam.APPS_COLUMN_ORDER);
            }

            this.props.dispatch(AppsListActions.setHiddenColumns(hiddenIds));
            if (hiddenIds.length > 0) {
              HistoryManager.setParam(URLParam.APPS_HIDDEN_COLUMNS, hiddenIds.join(','));
            } else {
              HistoryManager.deleteParam(URLParam.APPS_HIDDEN_COLUMNS);
            }

            this.setState({ showColumnManagement: false });
          }}
          description={t('Selected categories will be displayed in the table. Drag and drop to reorder columns.')}
          enableDragDrop={true}
          isOpen={this.state.showColumnManagement}
          onClose={() => this.setState({ showColumnManagement: false })}
          onResetToDefault={this.resetAppsColumnsToDefault}
          title={t('Manage columns')}
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
