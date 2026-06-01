import * as React from 'react';
import * as FilterHelper from '../../components/FilterList/FilterHelper';
import { RenderContent } from '../../components/Nav/Page';
import * as ServiceListFilters from './FiltersAndSorts';
import * as FilterComponent from '../../components/FilterList/FilterComponent';
import { ServiceList, ServiceListItem } from '../../types/ServiceList';
import { InstanceType, IntervalInMilliseconds, TimeInMilliseconds } from '../../types/Common';
import { Namespace } from '../../types/Namespace';
import { PromisesRegistry } from '../../utils/CancelablePromises';
import { namespaceEquals } from '../../utils/Common';
import { SortField } from '../../types/SortFilters';
import { ActiveFiltersInfo, ActiveTogglesInfo } from '../../types/Filters';
import { FilterSelected, StatefulFilters, Toggles } from '../../components/Filters/StatefulFilters';
import * as API from '../../services/Api';
import { addError } from '../../utils/AlertUtils';
import { ObjectValidation, Validations } from '../../types/IstioObjects';
import { VirtualList } from '../../components/VirtualList/VirtualList';
import { KialiAppState } from '../../store/Store';
import { activeNamespacesSelector, refreshIntervalSelector } from '../../store/Selectors';
import { DefaultSecondaryMasthead } from '../../components/DefaultSecondaryMasthead/DefaultSecondaryMasthead';
import { HealthComputeDurationMastheadToolbar } from 'components/Time/HealthComputeDurationMastheadToolbar';
import { connect } from 'react-redux';
import { Refresh } from '../../components/Refresh/Refresh';
import { sortIstioReferences } from '../AppList/FiltersAndSorts';
import { validationKey } from '../../types/IstioConfigList';
import { ServiceHealth } from '../../types/Health';
import { healthComputeDurationValidSeconds } from 'utils/HealthComputeDuration';
import { isMultiCluster, serverConfig } from 'config';
import { connectRefresh } from 'components/Refresh/connectRefresh';
import { RefreshIntervalManual, RefreshIntervalPause } from 'config/Config';
import { HistoryManager, URLParam } from 'app/History';
import { endPerfTimer, startPerfTimer } from '../../utils/PerformanceUtils';
import { arrayEquals } from '../../utils/Common';
import {
  ColumnManagementModalColumn,
  ListColumnManagementModal
} from '../../components/Filters/ListColumnManagementModal';
import { ManagedColumn } from '../../components/VirtualList/ManagedColumnTypes';
import { ServicesListActions } from '../../actions/ServicesListActions';
import { config as virtualListConfig } from '../../components/VirtualList/Config';
import { t } from 'utils/I18nUtils';
import { KialiDispatch } from 'types/Redux';
import { StatefulFiltersRef } from '../../components/Filters/StatefulFilters';

type ServiceListPageState = FilterComponent.State<ServiceListItem> & {
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

type ServiceListPageProps = ReduxProps &
  ReduxDispatchProps & {
    lastRefreshAt: TimeInMilliseconds; // redux by way of ConnectRefresh
  };

class ServiceListPageComponent extends FilterComponent.Component<
  ServiceListPageProps,
  ServiceListPageState,
  ServiceListItem
> {
  private sFStatefulFilters: StatefulFiltersRef = React.createRef();
  private promises = new PromisesRegistry();
  private initialToggles = ServiceListFilters.getAvailableToggles();

  constructor(props: ServiceListPageProps) {
    super(props);
    const prevCurrentSortField = FilterHelper.currentSortField(ServiceListFilters.sortFields);
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

  componentDidUpdate(prevProps: ServiceListPageProps): void {
    const prevCurrentSortField = FilterHelper.currentSortField(ServiceListFilters.sortFields);
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
    const validIds = defaultIds.filter(id => id !== 'service');

    const urlParam = HistoryManager.getParam(URLParam.SERVICES_HIDDEN_COLUMNS);
    if (urlParam !== undefined) {
      const ids = urlParam
        .split(',')
        .map(s => s.trim().toLowerCase())
        .filter(Boolean);
      const filtered = ids.filter(id => validIds.includes(id));
      if (filtered.length > 0 && !arrayEquals(filtered, this.props.hiddenColumnIds, (a, b) => a === b)) {
        this.props.dispatch(ServicesListActions.setHiddenColumns(filtered));
      } else if (filtered.length === 0 && this.props.hiddenColumnIds.length > 0) {
        this.props.dispatch(ServicesListActions.setHiddenColumns([]));
      }
    } else if (this.props.hiddenColumnIds.length > 0) {
      HistoryManager.setParam(URLParam.SERVICES_HIDDEN_COLUMNS, this.props.hiddenColumnIds.join(','));
    }

    const orderParam = HistoryManager.getParam(URLParam.SERVICES_COLUMN_ORDER);
    if (orderParam !== undefined) {
      const orderIds = orderParam
        .split(',')
        .map(s => s.trim().toLowerCase())
        .filter(Boolean);
      const validOrder = orderIds.filter(id => defaultIds.includes(id));
      if (validOrder.length > 0 && !arrayEquals(validOrder, this.props.columnOrder, (a, b) => a === b)) {
        this.props.dispatch(ServicesListActions.setColumnOrder(validOrder));
      } else if (validOrder.length === 0 && this.props.columnOrder.length > 0) {
        this.props.dispatch(ServicesListActions.setColumnOrder([]));
      }
    } else if (this.props.columnOrder.length > 0) {
      HistoryManager.setParam(URLParam.SERVICES_COLUMN_ORDER, this.props.columnOrder.join(','));
    }
  };

  private getDefaultManagedColumns = (): ManagedColumn[] => {
    return virtualListConfig.services.columns
      .filter(c => c.title && c.title.trim().length > 0)
      .map(c => {
        const id = (c.id ?? c.name.toLowerCase()).toLowerCase();
        return {
          id,
          title: c.title,
          isShown: true,
          isDisabled: id === 'service'
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

  private resetServicesColumnsToDefault = (): void => {
    this.props.dispatch(ServicesListActions.setColumnOrder([]));
    this.props.dispatch(ServicesListActions.setHiddenColumns([]));
    HistoryManager.deleteParam(URLParam.SERVICES_COLUMN_ORDER);
    HistoryManager.deleteParam(URLParam.SERVICES_HIDDEN_COLUMNS);
  };

  private getAppliedColumnsForModal = (): ColumnManagementModalColumn[] => {
    return this.getManagedColumns()
      .filter(c => isMultiCluster || c.id !== 'cluster')
      .map(c => ({
        key: c.id,
        title: c.title,
        isShownByDefault: true,
        isShown: c.isShown,
        isUntoggleable: c.id === 'service'
      }));
  };

  onSort = (): void => {
    // force list update on sorting
    this.setState({});
  };

  sortItemList(
    services: ServiceListItem[],
    sortField: SortField<ServiceListItem>,
    isAscending: boolean
  ): ServiceListItem[] {
    // Chain promises, as there may be an ongoing fetch/refresh and sort can be called after UI interaction
    // This ensures that the list will display the new data with the right sorting
    return ServiceListFilters.sortServices(services, sortField, isAscending);
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
      this.fetchServices(Array.from(uniqueClusters), activeFilters, activeToggles);
    } else {
      this.setState({ listItems: [], loaded: true });
    }
  }

  getServiceItem(data: ServiceList): ServiceListItem[] {
    if (data.services) {
      const rateInterval = healthComputeDurationValidSeconds();
      return data.services.map(service => ({
        name: service.name,
        instanceType: InstanceType.Service,
        istioSidecar: service.istioSidecar,
        isAmbient: service.isAmbient,
        isWaypoint: service.isWaypoint,
        isZtunnel: service.isZtunnel,
        namespace: service.namespace,
        cluster: service.cluster,
        health: ServiceHealth.fromJson(service.namespace, service.name, service.health ?? {}, {
          rateInterval,
          hasSidecar: service.istioSidecar,
          hasAmbient: service.isAmbient
        }),
        validation: this.getServiceValidation(service.name, service.namespace, data.validations),
        additionalDetailSample: service.additionalDetailSample,
        labels: service.labels ?? {},
        ports: service.ports ?? {},
        istioReferences: sortIstioReferences(service.istioReferences, true),
        kialiWizard: service.kialiWizard,
        serviceRegistry: service.serviceRegistry
      }));
    }

    return [];
  }

  fetchServices(clusters: string[], filters: ActiveFiltersInfo, toggles: ActiveTogglesInfo): void {
    const perfKey = 'ClustersServices';
    const servicesPromises = clusters.map(cluster => {
      startPerfTimer(perfKey);
      return API.getClustersServices(
        this.props.activeNamespaces.map(ns => ns.name).join(','),
        {
          health: toggles.get('health') ?? true,
          istioResources: toggles.get('istioResources') ?? true,
          onlyDefinitions: toggles.get('configuration') !== undefined ? !toggles.get('configuration') : false // !configuration => onlyDefinitions
        },
        cluster
      );
    });

    this.promises
      .registerAll('services', servicesPromises)
      .then(responses => {
        let serviceListItems: ServiceListItem[] = [];

        responses.forEach(response => {
          endPerfTimer(perfKey);
          serviceListItems = serviceListItems.concat(this.getServiceItem(response.data));
        });

        return ServiceListFilters.filterBy(serviceListItems, filters);
      })
      .then(serviceListItems => {
        this.promises.cancel('sort');

        const sortedServiceListItems = this.sortItemList(
          serviceListItems,
          this.state.currentSortField,
          this.state.isSortAscending
        );

        this.setState({
          listItems: sortedServiceListItems,
          loaded: true
        });
      })
      .catch(err => {
        if (!err.isCanceled) {
          addError('Could not fetch services list', err);
        }
      });
  }

  getServiceValidation(name: string, namespace: string, validations: Validations): ObjectValidation | undefined {
    const type = 'service'; // Using 'service' directly is disallowed

    if (validations[type] && validations[type][validationKey(name, namespace)]) {
      return validations[type][validationKey(name, namespace)];
    }

    return undefined;
  }

  render(): React.ReactNode {
    const hiddenColumns = isMultiCluster ? [] : ['cluster'];

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
              <Refresh id="service-list-refresh" disabled={false} manageURL={true} />
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
            type="services"
          >
            <StatefulFilters
              columnManagement={true}
              columnManagementButtonTestId="services-manage-columns"
              initialFilters={ServiceListFilters.availableFilters}
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
            this.props.dispatch(ServicesListActions.setColumnOrder(orderedIds));
            if (orderedIds.length > 0) {
              HistoryManager.setParam(URLParam.SERVICES_COLUMN_ORDER, orderedIds.join(','));
            } else {
              HistoryManager.deleteParam(URLParam.SERVICES_COLUMN_ORDER);
            }

            this.props.dispatch(ServicesListActions.setHiddenColumns(hiddenIds));
            if (hiddenIds.length > 0) {
              HistoryManager.setParam(URLParam.SERVICES_HIDDEN_COLUMNS, hiddenIds.join(','));
            } else {
              HistoryManager.deleteParam(URLParam.SERVICES_HIDDEN_COLUMNS);
            }

            this.setState({ showColumnManagement: false });
          }}
          description={t('Selected categories will be displayed in the table. Drag and drop to reorder columns.')}
          enableDragDrop={true}
          isOpen={this.state.showColumnManagement}
          onClose={() => this.setState({ showColumnManagement: false })}
          onResetToDefault={this.resetServicesColumnsToDefault}
          title={t('Manage columns')}
        />
      </>
    );
  }
}

const mapStateToProps = (state: KialiAppState): ReduxProps => ({
  activeNamespaces: activeNamespacesSelector(state),
  columnOrder: state.servicesList.columnOrder,
  hiddenColumnIds: state.servicesList.hiddenColumnIds,
  refreshInterval: refreshIntervalSelector(state)
});

export const ServiceListPage = connectRefresh(connect(mapStateToProps)(ServiceListPageComponent));
