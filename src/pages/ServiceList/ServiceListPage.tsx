import * as React from 'react';
import * as FilterHelper from '../../components/FilterList/FilterHelper';
import { RenderContent } from '../../components/Nav/Page';
import * as ServiceListFilters from './FiltersAndSorts';
import * as FilterComponent from '../../components/FilterList/FilterComponent';
import { ServiceList, ServiceListItem } from '../../types/ServiceList';
import { DurationInSeconds } from '../../types/Common';
import Namespace from '../../types/Namespace';
import { PromisesRegistry } from '../../utils/CancelablePromises';
import { namespaceEquals } from '../../utils/Common';
import { SortField } from '../../types/SortFilters';
import { ActiveFiltersInfo } from '../../types/Filters';
import { FilterSelected, StatefulFilters } from '../../components/Filters/StatefulFilters';
import * as API from '../../services/Api';
import { ObjectValidation, Validations } from '../../types/IstioObjects';
import VirtualList from '../../components/VirtualList/VirtualList';
import { KialiAppState } from '../../store/Store';
import { activeNamespacesSelector, durationSelector } from '../../store/Selectors';
import DefaultSecondaryMasthead from '../../components/DefaultSecondaryMasthead/DefaultSecondaryMasthead';
import { connect } from 'react-redux';
import TimeDurationContainer from '../../components/Time/TimeDurationComponent';
import { sortIstioReferences } from '../AppList/FiltersAndSorts';

type ServiceListPageState = FilterComponent.State<ServiceListItem>;

type ReduxProps = {
  duration: DurationInSeconds;
  activeNamespaces: Namespace[];
};

type ServiceListPageProps = ReduxProps & FilterComponent.Props<ServiceListItem>;

class ServiceListPageComponent extends FilterComponent.Component<
  ServiceListPageProps,
  ServiceListPageState,
  ServiceListItem
> {
  private promises = new PromisesRegistry();

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

  componentDidMount() {
    this.updateListItems();
  }

  componentDidUpdate(prevProps: ServiceListPageProps, _prevState: ServiceListPageState, _snapshot: any) {
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

  componentWillUnmount() {
    this.promises.cancelAll();
  }

  sortItemList(services: ServiceListItem[], sortField: SortField<ServiceListItem>, isAscending: boolean) {
    // Chain promises, as there may be an ongoing fetch/refresh and sort can be called after UI interaction
    // This ensures that the list will display the new data with the right sorting
    return this.promises.registerChained('sort', services, unsorted =>
      ServiceListFilters.sortServices(unsorted, sortField, isAscending)
    );
  }

  updateListItems() {
    this.promises.cancelAll();

    const activeFilters: ActiveFiltersInfo = FilterSelected.getSelected();
    const namespacesSelected = this.props.activeNamespaces.map(item => item.name);

    if (namespacesSelected.length !== 0) {
      this.fetchServices(namespacesSelected, activeFilters, this.props.duration);
    } else {
      this.setState({ listItems: [] });
    }
  }

  getServiceItem(data: ServiceList, rateInterval: number): ServiceListItem[] {
    if (data.services) {
      return data.services.map(service => ({
        name: service.name,
        istioSidecar: service.istioSidecar,
        namespace: data.namespace.name,
        healthPromise: API.getServiceHealth(data.namespace.name, service.name, rateInterval, service.istioSidecar),
        validation: this.getServiceValidation(service.name, data.validations),
        additionalDetailSample: service.additionalDetailSample,
        labels: service.labels || {},
        istioReferences: sortIstioReferences(service.istioReferences, true),
        kialiWizard: service.kialiWizard,
        serviceRegistry: service.serviceRegistry
      }));
    }
    return [];
  }

  fetchServices(namespaces: string[], filters: ActiveFiltersInfo, rateInterval: number) {
    const servicesPromises = namespaces.map(ns => API.getServices(ns));

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
        this.sortItemList(serviceListItems, this.state.currentSortField, this.state.isSortAscending)
          .then(sorted => {
            this.setState({
              listItems: sorted
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
          this.handleAxiosError('Could not fetch services list', err);
        }
      });
  }

  getServiceValidation(name: string, validations: Validations): ObjectValidation {
    const type = 'service'; // Using 'service' directly is disallowed
    return validations[type][name];
  }

  render() {
    return (
      <>
        <div style={{ backgroundColor: '#fff' }}>
          <DefaultSecondaryMasthead
            rightToolbar={
              <TimeDurationContainer
                key={'DurationDropdown'}
                id="service-list-duration-dropdown"
                handleRefresh={this.updateListItems}
                disabled={false}
              />
            }
          />
        </div>
        <RenderContent>
          <VirtualList rows={this.state.listItems}>
            <StatefulFilters
              initialFilters={ServiceListFilters.availableFilters}
              onFilterChange={this.onFilterChange}
            />
          </VirtualList>
        </RenderContent>
      </>
    );
  }
}

const mapStateToProps = (state: KialiAppState) => ({
  activeNamespaces: activeNamespacesSelector(state),
  duration: durationSelector(state)
});

const ServiceListPage = connect(mapStateToProps)(ServiceListPageComponent);
export default ServiceListPage;
