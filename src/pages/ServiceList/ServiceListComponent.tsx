import * as React from 'react';
import { ListView, ListViewItem, ListViewIcon, Sort } from 'patternfly-react';
import { Link } from 'react-router-dom';
import { NamespaceFilter, NamespaceFilterSelected } from '../../components/NamespaceFilter/NamespaceFilter';
import { Paginator } from 'patternfly-react';
import { ActiveFilter, FilterType } from '../../types/NamespaceFilter';
import * as API from '../../services/Api';
import Namespace from '../../types/Namespace';
import { Pagination } from '../../types/Pagination';
import { IstioLogo, ServiceItem, ServiceList, SortField } from '../../types/ServiceListComponent';
import PropTypes from 'prop-types';
import MetricsOptionsBar from '../../components/MetricsOptions/MetricsOptionsBar';
import { HealthIndicator, DisplayMode } from '../../components/ServiceHealth/HealthIndicator';
import ServiceErrorRate from './ServiceErrorRate';
import ServiceItemComparer from './ServiceItemComparer';
import RateIntervalToolbarItem from './RateIntervalToolbarItem';

import './ServiceListComponent.css';

const sortFields: SortField[] = [
  {
    id: 'namespace',
    title: 'Namespace',
    isNumeric: false
  },
  {
    id: 'servicename',
    title: 'Service Name',
    isNumeric: false
  },
  {
    id: 'istio_sidecar',
    title: 'Istio Sidecar',
    isNumeric: false
  },
  {
    id: 'error_rate',
    title: 'Error Rate',
    isNumeric: true
  }
];

const serviceNameFilter: FilterType = {
  id: 'servicename',
  title: 'Service Name',
  placeholder: 'Filter by Service Name',
  filterType: 'text',
  filterValues: []
};

const istioFilter: FilterType = {
  id: 'istio',
  title: 'Istio Sidecar',
  placeholder: 'Filter by Istio Sidecar',
  filterType: 'select',
  filterValues: [{ id: 'deployed', title: 'Deployed' }, { id: 'undeployed', title: 'Undeployed' }]
};

type ServiceListComponentState = {
  loading: boolean;
  services: ServiceItem[];
  pagination: Pagination;
  currentSortField: SortField;
  isSortAscending: boolean;
  rateInterval: string;
};

type ServiceListComponentProps = {
  onError: PropTypes.func;
};

const perPageOptions: number[] = [5, 10, 15];

class ServiceListComponent extends React.Component<ServiceListComponentProps, ServiceListComponentState> {
  constructor(props: ServiceListComponentProps) {
    super(props);
    this.filterChange = this.filterChange.bind(this);
    this.handleError = this.handleError.bind(this);
    this.pageSet = this.pageSet.bind(this);
    this.pageSelect = this.pageSelect.bind(this);
    this.updateSortField = this.updateSortField.bind(this);
    this.updateSortDirection = this.updateSortDirection.bind(this);
    this.state = {
      loading: true,
      services: [],
      pagination: { page: 1, perPage: 10, perPageOptions: perPageOptions },
      currentSortField: sortFields[0],
      isSortAscending: true,
      rateInterval: MetricsOptionsBar.DefaultRateInterval
    };
  }

  componentDidMount() {
    this.setState({ loading: true });
    this.updateServices();
  }

  filterChange() {
    this.setState({ loading: true });
    this.updateServices();
  }

  handleError(error: string) {
    this.props.onError(error);
    this.setState({ loading: false });
  }

  pageSet(page: number) {
    this.setState(prevState => {
      return {
        loading: prevState.loading,
        services: prevState.services,
        pagination: {
          page: page,
          perPage: prevState.pagination.perPage,
          perPageOptions: perPageOptions
        }
      };
    });
  }

  pageSelect(perPage: number) {
    this.setState(prevState => {
      return {
        loading: prevState.loading,
        services: prevState.services,
        pagination: {
          page: 1,
          perPage: perPage,
          perPageOptions: perPageOptions
        }
      };
    });
  }

  updateSortField(sortField: SortField) {
    this.setState(prevState => {
      return {
        currentSortField: sortField,
        services: this.sortServices(prevState.services, sortField, prevState.isSortAscending)
      };
    });
  }

  updateSortDirection() {
    this.setState(prevState => {
      return {
        isSortAscending: !prevState.isSortAscending,
        services: this.sortServices(prevState.services, prevState.currentSortField, !prevState.isSortAscending)
      };
    });
  }

  updateServices(rateInterval: string = MetricsOptionsBar.DefaultRateInterval) {
    const activeFilters: ActiveFilter[] = NamespaceFilterSelected.getSelected();
    let namespacesSelected: string[] = activeFilters
      .filter(activeFilter => activeFilter.category === 'Namespace')
      .map(activeFilter => activeFilter.value);
    let servicenameFilters: string[] = activeFilters
      .filter(activeFilter => activeFilter.category === 'Service Name')
      .map(activeFilter => activeFilter.value);
    let istioFilters: string[] = activeFilters
      .filter(activeFilter => activeFilter.category === 'Istio Sidecar')
      .map(activeFilter => activeFilter.value);
    istioFilters = this.cleanIstioFilters(istioFilters);

    if (namespacesSelected.length === 0) {
      API.GetNamespaces()
        .then(namespacesResponse => {
          const namespaces: Namespace[] = namespacesResponse['data'];
          this.fetchServices(
            namespaces.map(namespace => namespace.name),
            servicenameFilters,
            istioFilters,
            rateInterval
          );
        })
        .catch(namespacesError => {
          console.error(JSON.stringify(namespacesError));
          this.handleError(API.GetErrorMsg('Could not fetch namespace list.', namespacesError));
        });
    } else {
      this.fetchServices(namespacesSelected, servicenameFilters, istioFilters);
    }
  }

  fetchServices(namespaces: string[], servicenameFilters: string[], istioFilters: string[], rateInterval?: string) {
    const promises = namespaces.map(ns => API.GetServices(ns, { rateInterval: rateInterval }));
    Promise.all(promises)
      .then(servicesResponse => {
        let updatedServices: ServiceItem[] = [];
        servicesResponse.forEach(serviceResponse => {
          const serviceList: ServiceList = serviceResponse['data'];
          const namespace = serviceList.namespace;
          serviceList.services.forEach(serviceName => {
            let serviceItem: ServiceItem = {
              namespace: namespace.name,
              servicename: serviceName.name,
              health: serviceName.health,
              istio_sidecar: serviceName.istio_sidecar,
              request_count: serviceName.request_count,
              request_error_count: serviceName.request_error_count,
              error_rate: serviceName.error_rate
            };
            updatedServices.push(serviceItem);
          });
        });
        if (servicenameFilters.length > 0 || istioFilters.length > 0) {
          updatedServices = this.filterServices(updatedServices, servicenameFilters, istioFilters);
        }
        updatedServices = this.sortServices(updatedServices, this.state.currentSortField, this.state.isSortAscending);
        this.setState(prevState => {
          return {
            loading: false,
            services: updatedServices,
            pagination: {
              page: 1,
              perPage: prevState.pagination.perPage,
              perPageOptions: perPageOptions
            }
          };
        });
      })
      .catch(servicesError => {
        console.error(JSON.stringify(servicesError));
        this.handleError(API.GetErrorMsg('Could not fetch service list.', servicesError));
      });
  }

  // Patternfly-react Filter has not a boolean / checkbox filter option, so as we want to use the same component
  // this function is used to optimize potential duplications on 'Deployed', 'Undeployed' values selected.
  cleanIstioFilters(istioFilters: string[]) {
    if (istioFilters.length === 0) {
      return [];
    }
    let cleanArray = istioFilters.filter((iFilter, i) => {
      return istioFilters.indexOf(iFilter) === i;
    });

    if (cleanArray.length === 2) {
      return [];
    }
    return cleanArray;
  }

  isFiltered(service: ServiceItem, servicenameFilters: string[], istioFilters: string[]) {
    let serviceNameFiltered = true;
    if (servicenameFilters.length > 0) {
      serviceNameFiltered = false;
      for (let i = 0; i < servicenameFilters.length; i++) {
        if (service.servicename.includes(servicenameFilters[i])) {
          serviceNameFiltered = true;
          break;
        }
      }
    }

    let istioFiltered = true;
    if (istioFilters.length === 1) {
      if (istioFilters[0] === 'Deployed') {
        istioFiltered = service.istio_sidecar;
      }
      if (istioFilters[0] === 'Undeployed') {
        istioFiltered = !service.istio_sidecar;
      }
    }

    return serviceNameFiltered && istioFiltered;
  }

  filterServices(services: ServiceItem[], servicenameFilters: string[], istioFilters: string[]) {
    let filteredServices: ServiceItem[] = services.filter(service =>
      this.isFiltered(service, servicenameFilters, istioFilters)
    );
    return filteredServices;
  }

  sortServices(services: ServiceItem[], sortField: SortField, isAscending: boolean): ServiceItem[] {
    const comparer = new ServiceItemComparer(sortField, isAscending);
    return services.sort(comparer.compareFunction);
  }

  render() {
    let serviceList: any = [];
    let pageStart = (this.state.pagination.page - 1) * this.state.pagination.perPage;
    let pageEnd = pageStart + this.state.pagination.perPage;
    pageEnd = pageEnd < this.state.services.length ? pageEnd : this.state.services.length;

    for (let i = pageStart; i < pageEnd; i++) {
      const serviceItem = this.state.services[i];
      const to = '/namespaces/' + serviceItem.namespace + '/services/' + serviceItem.servicename;
      const serviceDescriptor = (
        <table style={{ width: '30em', tableLayout: 'fixed' }}>
          <tr>
            <td>
              <strong>Health: </strong>
              <HealthIndicator health={serviceItem.health} mode={DisplayMode.SMALL} />
            </td>
            <td>
              <ServiceErrorRate service={serviceItem} />
            </td>
          </tr>
        </table>
      );

      serviceList.push(
        <Link key={to} to={to} style={{ color: 'black' }}>
          <ListViewItem
            leftContent={<ListViewIcon type="pf" name="service" />}
            heading={
              <div className="ServiceList-Heading">
                <div className="ServiceList-IstioLogo">
                  {serviceItem.istio_sidecar ? (
                    <img className="IstioLogo" src={IstioLogo} alt="Istio sidecar" />
                  ) : (
                    undefined
                  )}
                </div>
                <div className="ServiceList-Title">
                  {serviceItem.servicename}
                  <small>{serviceItem.namespace}</small>
                </div>
              </div>
            }
            description={serviceDescriptor}
          />
        </Link>
      );
    }

    let serviceListComponent;
    if (this.state.loading) {
      serviceListComponent = <div className="spinner spinner-sm left-spinner" />;
    } else {
      serviceListComponent = (
        <div>
          <NamespaceFilter
            initialFilters={[serviceNameFilter, istioFilter]}
            onFilterChange={this.filterChange}
            onError={this.handleError}
          >
            <Sort>
              <Sort.TypeSelector
                sortTypes={sortFields}
                currentSortType={this.state.currentSortField}
                onSortTypeSelected={this.updateSortField}
              />
              <Sort.DirectionSelector
                isNumeric={this.state.currentSortField.isNumeric}
                isAscending={this.state.isSortAscending}
                onClick={this.updateSortDirection}
              />
            </Sort>
            <RateIntervalToolbarItem
              rateIntervalSelected={this.state.rateInterval}
              onRateIntervalChanged={this.rateIntervalChangedHandler}
            />
          </NamespaceFilter>
          <ListView>{serviceList}</ListView>
          <Paginator
            viewType="list"
            pagination={this.state.pagination}
            itemCount={this.state.services.length}
            onPageSet={this.pageSet}
            onPerPageSelect={this.pageSelect}
          />
        </div>
      );
    }
    return <div>{serviceListComponent}</div>;
  }

  private rateIntervalChangedHandler = (key: string) => {
    this.setState({
      rateInterval: key,
      loading: true
    });
    this.updateServices(key);
  };
}

export default ServiceListComponent;
