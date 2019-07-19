import * as React from 'react';
import { connect } from 'react-redux';
import { ToolbarRightContent } from 'patternfly-react';
import { FilterSelected, StatefulFilters } from '../../components/Filters/StatefulFilters';
import * as API from '../../services/Api';
import Namespace from '../../types/Namespace';
import { ActiveFilter } from '../../types/Filters';
import { ServiceList, ServiceListItem } from '../../types/ServiceList';
import { PromisesRegistry } from '../../utils/CancelablePromises';
import * as ServiceListFilters from './FiltersAndSorts';
import './ServiceListComponent.css';
import { SortField } from '../../types/SortFilters';
import * as FilterComponent from '../../components/FilterList/FilterComponent';
import { AlignRightStyle } from '../../components/Filters/FilterStyles';
import { namespaceEquals } from '../../utils/Common';
import { KialiAppState } from '../../store/Store';
import { activeNamespacesSelector, durationSelector } from '../../store/Selectors';
import { DurationInSeconds } from '../../types/Common';
import { DurationDropdownContainer } from '../../components/DurationDropdown/DurationDropdown';
import RefreshButtonContainer from '../../components/Refresh/RefreshButton';
import { ObjectValidation, Validations } from '../../types/IstioObjects';
import { VirtualList } from '../../components/VirtualList/VirtualList';

type ServiceListComponentState = FilterComponent.State<ServiceListItem>;

type ReduxProps = {
  duration: DurationInSeconds;
  activeNamespaces: Namespace[];
};

type ServiceListComponentProps = ReduxProps & FilterComponent.Props<ServiceListItem>;

class ServiceListComponent extends FilterComponent.Component<
  ServiceListComponentProps,
  ServiceListComponentState,
  ServiceListItem
> {
  private promises = new PromisesRegistry();

  constructor(props: ServiceListComponentProps) {
    super(props);

    this.state = {
      listItems: [],
      currentSortField: this.props.currentSortField,
      isSortAscending: this.props.isSortAscending
    };
  }

  componentDidMount() {
    this.updateListItems();
  }

  componentDidUpdate(prevProps: ServiceListComponentProps, _prevState: ServiceListComponentState, _snapshot: any) {
    const [paramsSynced] = this.paramsAreSynced(prevProps);
    if (!paramsSynced) {
      this.setState({
        currentSortField: this.props.currentSortField,
        isSortAscending: this.props.isSortAscending
      });

      this.updateListItems();
    }
  }

  componentWillUnmount() {
    this.promises.cancelAll();
  }

  paramsAreSynced = (prevProps: ServiceListComponentProps): [boolean, boolean] => {
    const activeNamespacesCompare = namespaceEquals(prevProps.activeNamespaces, this.props.activeNamespaces);
    const paramsSynced =
      prevProps.duration === this.props.duration &&
      activeNamespacesCompare &&
      prevProps.isSortAscending === this.props.isSortAscending &&
      prevProps.currentSortField.title === this.props.currentSortField.title;
    return [paramsSynced, activeNamespacesCompare];
  };

  sortItemList(services: ServiceListItem[], sortField: SortField<ServiceListItem>, isAscending: boolean) {
    // Chain promises, as there may be an ongoing fetch/refresh and sort can be called after UI interaction
    // This ensures that the list will display the new data with the right sorting
    return this.promises.registerChained('sort', services, unsorted =>
      ServiceListFilters.sortServices(unsorted, sortField, isAscending)
    );
  }

  updateListItems() {
    this.promises.cancelAll();

    const activeFilters: ActiveFilter[] = FilterSelected.getSelected();
    const namespacesSelected = this.props.activeNamespaces.map(item => item.name);

    if (namespacesSelected.length === 0) {
      this.promises
        .register('namespaces', API.getNamespaces())
        .then(namespacesResponse => {
          const namespaces: Namespace[] = namespacesResponse.data;
          this.fetchServices(namespaces.map(namespace => namespace.name), activeFilters, this.props.duration);
        })
        .catch(namespacesError => {
          if (!namespacesError.isCanceled) {
            this.handleAxiosError('Could not fetch namespace list', namespacesError);
          }
        });
    } else {
      this.fetchServices(namespacesSelected, activeFilters, this.props.duration);
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
        apiType: service.apiType
      }));
    }
    return [];
  }

  fetchServices(namespaces: string[], filters: ActiveFilter[], rateInterval: number) {
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
      <VirtualList rows={this.state.listItems} scrollFilters={false} updateItems={this.updateListItems}>
        <StatefulFilters initialFilters={ServiceListFilters.availableFilters} onFilterChange={this.onFilterChange}>
          <ToolbarRightContent style={{ ...AlignRightStyle }}>
            <DurationDropdownContainer id="service-list-duration-dropdown" />
            <RefreshButtonContainer handleRefresh={this.updateListItems} />
          </ToolbarRightContent>
        </StatefulFilters>
      </VirtualList>
    );
  }
}

const mapStateToProps = (state: KialiAppState) => ({
  activeNamespaces: activeNamespacesSelector(state),
  duration: durationSelector(state)
});

const ServiceListComponentContainer = connect(mapStateToProps)(ServiceListComponent);
export default ServiceListComponentContainer;
