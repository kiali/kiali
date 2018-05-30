import * as React from 'react';
import { ListView, ListViewItem, ListViewIcon, Sort } from 'patternfly-react';
import { Link } from 'react-router-dom';
import { NamespaceFilter, NamespaceFilterSelected } from '../../components/NamespaceFilter/NamespaceFilter';
import { Paginator } from 'patternfly-react';
import { ActiveFilter, FilterType } from '../../types/NamespaceFilter';
import * as API from '../../services/Api';
import Namespace from '../../types/Namespace';
import { Pagination } from '../../types/Pagination';
import { IstioLogo, ServiceItem, ServiceList, SortField, overviewToItem } from '../../types/ServiceListComponent';
import PropTypes from 'prop-types';
import { getRequestErrorsRatio } from '../../components/ServiceHealth/HealthHelper';
import { HealthIndicator, DisplayMode } from '../../components/ServiceHealth/HealthIndicator';
import ServiceErrorRate from './ServiceErrorRate';
import RateIntervalToolbarItem from './RateIntervalToolbarItem';
import { PfColors } from '../../components/Pf/PfColors';
import './ServiceListComponent.css';
import { authentication } from '../../utils/Authentication';

// Exported for test
export const sortFields: SortField[] = [
  {
    title: 'Namespace',
    isNumeric: false,
    compare: (a: ServiceItem, b: ServiceItem) => {
      let sortValue = a.namespace.localeCompare(b.namespace);
      if (sortValue === 0) {
        sortValue = a.name.localeCompare(b.name);
      }
      return sortValue;
    }
  },
  {
    title: 'Service Name',
    isNumeric: false,
    compare: (a: ServiceItem, b: ServiceItem) => a.name.localeCompare(b.name)
  },
  {
    title: 'Istio Sidecar',
    isNumeric: false,
    compare: (a: ServiceItem, b: ServiceItem) => {
      if (a.istioSidecar && !b.istioSidecar) {
        return -1;
      } else if (!a.istioSidecar && b.istioSidecar) {
        return 1;
      } else {
        return a.name.localeCompare(b.name);
      }
    }
  },
  {
    title: 'Error Rate',
    isNumeric: true,
    compare: (a: ServiceItem, b: ServiceItem) => {
      const ratioA = getRequestErrorsRatio(a.health.requests);
      const ratioB = getRequestErrorsRatio(b.health.requests);
      return ratioA === ratioB ? a.name.localeCompare(b.name) : ratioA - ratioB;
    }
  }
];

// Exported for test
export const sortServices = (services: ServiceItem[], sortField: SortField, isAscending: boolean): ServiceItem[] => {
  return services.sort(isAscending ? sortField.compare : (a, b) => sortField.compare(b, a));
};

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
const defaultRateInterval = '10m';

class ServiceListComponent extends React.Component<ServiceListComponentProps, ServiceListComponentState> {
  constructor(props: ServiceListComponentProps) {
    super(props);

    this.state = {
      loading: true,
      services: [],
      pagination: { page: 1, perPage: 10, perPageOptions: perPageOptions },
      currentSortField: sortFields[0],
      isSortAscending: true,
      rateInterval: defaultRateInterval
    };
  }

  componentDidMount() {
    this.setState({ loading: true });
    this.updateServices();
  }

  filterChange = () => {
    this.setState({ loading: true });
    this.updateServices();
  };

  handleError = (error: string) => {
    this.props.onError(error);
    this.setState({ loading: false });
  };

  pageSet = (page: number) => {
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
  };

  pageSelect = (perPage: number) => {
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
  };

  updateSortField = (sortField: SortField) => {
    this.setState(prevState => {
      return {
        currentSortField: sortField,
        services: sortServices(prevState.services, sortField, prevState.isSortAscending)
      };
    });
  };

  updateSortDirection = () => {
    this.setState(prevState => {
      return {
        isSortAscending: !prevState.isSortAscending,
        services: sortServices(prevState.services, prevState.currentSortField, !prevState.isSortAscending)
      };
    });
  };

  updateServices(rateInterval: string = defaultRateInterval) {
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
      API.getNamespaces(authentication())
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
          this.handleError(API.getErrorMsg('Could not fetch namespace list.', namespacesError));
        });
    } else {
      this.fetchServices(namespacesSelected, servicenameFilters, istioFilters);
    }
  }

  fetchServices(namespaces: string[], servicenameFilters: string[], istioFilters: string[], rateInterval?: string) {
    const promises = namespaces.map(ns => API.getServices(authentication(), ns, { rateInterval: rateInterval }));
    Promise.all(promises)
      .then(servicesResponse => {
        let updatedServices: ServiceItem[] = [];
        servicesResponse.forEach(serviceResponse => {
          const serviceList: ServiceList = serviceResponse.data;
          const namespace = serviceList.namespace;
          serviceList.services.forEach(overview => {
            updatedServices.push(overviewToItem(overview, namespace.name));
          });
        });
        if (servicenameFilters.length > 0 || istioFilters.length > 0) {
          updatedServices = this.filterServices(updatedServices, servicenameFilters, istioFilters);
        }
        updatedServices = sortServices(updatedServices, this.state.currentSortField, this.state.isSortAscending);
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
        this.handleError(API.getErrorMsg('Could not fetch service list.', servicesError));
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
        if (service.name.includes(servicenameFilters[i])) {
          serviceNameFiltered = true;
          break;
        }
      }
    }

    let istioFiltered = true;
    if (istioFilters.length === 1) {
      if (istioFilters[0] === 'Deployed') {
        istioFiltered = service.istioSidecar;
      }
      if (istioFilters[0] === 'Undeployed') {
        istioFiltered = !service.istioSidecar;
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

  render() {
    let serviceList: any = [];
    let pageStart = (this.state.pagination.page - 1) * this.state.pagination.perPage;
    let pageEnd = pageStart + this.state.pagination.perPage;
    pageEnd = pageEnd < this.state.services.length ? pageEnd : this.state.services.length;

    for (let i = pageStart; i < pageEnd; i++) {
      const serviceItem = this.state.services[i];
      const to = '/namespaces/' + serviceItem.namespace + '/services/' + serviceItem.name;
      const serviceDescriptor = (
        <table style={{ width: '30em', tableLayout: 'fixed' }}>
          <tbody>
            <tr>
              <td>
                <strong>Health: </strong>
                <HealthIndicator
                  id={serviceItem.name}
                  health={serviceItem.health}
                  mode={DisplayMode.SMALL}
                  rateInterval={this.state.rateInterval}
                />
              </td>
              <td>
                <ServiceErrorRate requestHealth={serviceItem.health.requests} />
              </td>
            </tr>
          </tbody>
        </table>
      );

      serviceList.push(
        <Link key={to} to={to} style={{ color: PfColors.Black }}>
          <ListViewItem
            leftContent={<ListViewIcon type="pf" name="service" />}
            heading={
              <div className="ServiceList-Heading">
                <div className="ServiceList-IstioLogo">
                  {serviceItem.istioSidecar ? (
                    <img className="IstioLogo" src={IstioLogo} alt="Istio sidecar" />
                  ) : (
                    undefined
                  )}
                </div>
                <div className="ServiceList-Title">
                  {serviceItem.name}
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
    serviceListComponent = (
      <>
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
      </>
    );
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
