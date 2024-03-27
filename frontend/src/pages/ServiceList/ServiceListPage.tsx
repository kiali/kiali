import * as React from 'react';
import * as FilterHelper from '../../components/FilterList/FilterHelper';
import { RenderContent } from '../../components/Nav/Page';
import * as ServiceListFilters from './FiltersAndSorts';
import * as FilterComponent from '../../components/FilterList/FilterComponent';
import { ServiceList, ServiceListItem } from '../../types/ServiceList';
import { DurationInSeconds } from '../../types/Common';
import { Namespace } from '../../types/Namespace';
import { PromisesRegistry } from '../../utils/CancelablePromises';
import { namespaceEquals } from '../../utils/Common';
import { SortField } from '../../types/SortFilters';
import { ActiveFiltersInfo, ActiveTogglesInfo } from '../../types/Filters';
import { FilterSelected, StatefulFilters, Toggles } from '../../components/Filters/StatefulFilters';
import * as API from '../../services/Api';
import { ObjectValidation, Validations } from '../../types/IstioObjects';
import { VirtualList } from '../../components/VirtualList/VirtualList';
import { KialiAppState } from '../../store/Store';
import { activeNamespacesSelector, durationSelector } from '../../store/Selectors';
import { DefaultSecondaryMasthead } from '../../components/DefaultSecondaryMasthead/DefaultSecondaryMasthead';
import { connect } from 'react-redux';
import { TimeDurationComponent } from '../../components/Time/TimeDurationComponent';
import { sortIstioReferences } from '../AppList/FiltersAndSorts';
import { validationKey } from '../../types/IstioConfigList';
import { ServiceHealth } from '../../types/Health';
import { RefreshNotifier } from '../../components/Refresh/RefreshNotifier';
import { isMultiCluster, serverConfig } from 'config';

type ServiceListPageState = FilterComponent.State<ServiceListItem>;

type ReduxProps = {
  activeNamespaces: Namespace[];
  duration: DurationInSeconds;
};

type ServiceListPageProps = ReduxProps & FilterComponent.Props<ServiceListItem>;

class ServiceListPageComponent extends FilterComponent.Component<
  ServiceListPageProps,
  ServiceListPageState,
  ServiceListItem
> {
  private promises = new PromisesRegistry();
  private initialToggles = ServiceListFilters.getAvailableToggles();

  constructor(props: ServiceListPageProps) {
    super(props);
    const prevCurrentSortField = FilterHelper.currentSortField(ServiceListFilters.sortFields);
    const prevIsSortAscending = FilterHelper.isCurrentSortAscending();

    this.state = {
      listItems: [],
      currentSortField: prevCurrentSortField,
      isSortAscending: prevIsSortAscending
    };
  }

  componentDidMount(): void {
    this.updateListItems();
  }

  componentDidUpdate(prevProps: ServiceListPageProps): void {
    const prevCurrentSortField = FilterHelper.currentSortField(ServiceListFilters.sortFields);
    const prevIsSortAscending = FilterHelper.isCurrentSortAscending();

    if (
      !namespaceEquals(this.props.activeNamespaces, prevProps.activeNamespaces) ||
      this.props.duration !== prevProps.duration ||
      this.state.currentSortField !== prevCurrentSortField ||
      this.state.isSortAscending !== prevIsSortAscending
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
      this.fetchServices(Array.from(uniqueClusters), activeFilters, activeToggles, this.props.duration);
    } else {
      this.setState({ listItems: [] });
    }
  }

  getServiceItem(data: ServiceList, rateInterval: number): ServiceListItem[] {
    if (data.services) {
      return data.services.map(service => ({
        name: service.name,
        istioSidecar: service.istioSidecar,
        istioAmbient: service.istioAmbient,
        namespace: service.namespace,
        cluster: service.cluster,
        health: ServiceHealth.fromJson(service.namespace, service.name, service.health, {
          rateInterval: rateInterval,
          hasSidecar: service.istioSidecar,
          hasAmbient: service.istioAmbient
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

  fetchServices(
    clusters: string[],
    filters: ActiveFiltersInfo,
    toggles: ActiveTogglesInfo,
    rateInterval: number
  ): void {
    const servicesPromises = clusters.map(cluster =>
      API.getClustersServices(
        this.props.activeNamespaces.map(ns => ns.name).join(','),
        {
          health: toggles.get('health') ?? true,
          istioResources: toggles.get('istioResources') ?? true,
          rateInterval: `${String(rateInterval)}s`,
          onlyDefinitions: toggles.get('configuration') !== undefined ? !toggles.get('configuration') : false // !configuration => onlyDefinitions
        },
        cluster
      )
    );

    this.promises
      .registerAll('services', servicesPromises)
      .then(responses => {
        let serviceListItems: ServiceListItem[] = [];

        responses.forEach(response => {
          serviceListItems = serviceListItems.concat(this.getServiceItem(response.data, rateInterval));
        });

        return ServiceListFilters.filterBy(serviceListItems, filters);
      })
      .then(serviceListItems => {
        this.promises.cancel('sort');

        this.setState({
          listItems: this.sortItemList(serviceListItems, this.state.currentSortField, this.state.isSortAscending)
        });
      })
      .catch(err => {
        if (!err.isCanceled) {
          this.handleApiError('Could not fetch services list', err);
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

    return (
      <>
        <RefreshNotifier onTick={this.updateListItems} />

        <DefaultSecondaryMasthead
          rightToolbar={
            <TimeDurationComponent key="DurationDropdown" id="service-list-duration-dropdown" disabled={false} />
          }
        />

        <RenderContent>
          <VirtualList rows={this.state.listItems} hiddenColumns={hiddenColumns} type="services">
            <StatefulFilters
              initialFilters={ServiceListFilters.availableFilters}
              initialToggles={this.initialToggles}
              onFilterChange={this.onFilterChange}
              onToggleChange={this.onFilterChange}
            />
          </VirtualList>
        </RenderContent>
      </>
    );
  }
}

const mapStateToProps = (state: KialiAppState): ReduxProps => ({
  activeNamespaces: activeNamespacesSelector(state),
  duration: durationSelector(state)
});

export const ServiceListPage = connect(mapStateToProps)(ServiceListPageComponent);
