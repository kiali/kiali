import * as React from 'react';
import { Col, Icon, ListView, ListViewItem, ListViewIcon, Sort } from 'patternfly-react';
import { Link } from 'react-router-dom';
import { NamespaceFilter, NamespaceFilterSelected } from '../../components/NamespaceFilter/NamespaceFilter';
import { Paginator } from 'patternfly-react';
import { ActiveFilter, FilterType } from '../../types/NamespaceFilter';
import * as API from '../../services/Api';
import Namespace from '../../types/Namespace';
import { Pagination } from '../../types/Pagination';
import { ServiceItem, ServiceList } from '../../types/ServiceListComponent';
import PropTypes from 'prop-types';

type SortField = {
  id: string;
  title: string;
  isNumeric: boolean;
};

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
  }
];

const serviceNameFilter: FilterType = {
  id: 'servicename',
  title: 'Service Name',
  placeholder: 'Filter by Service Name',
  filterType: 'text',
  filterValues: []
};

type ServiceListComponentState = {
  loading: boolean;
  services: ServiceItem[];
  pagination: Pagination;
  currentSortField: SortField;
  isSortAscending: boolean;
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
      isSortAscending: true
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

  updateServices() {
    const activeFilters: ActiveFilter[] = NamespaceFilterSelected.getSelected();
    let namespacesSelected: string[] = activeFilters
      .filter(activeFilter => activeFilter.category === 'Namespace')
      .map(activeFilter => activeFilter.value);
    let servicenameFilters: string[] = activeFilters
      .filter(activeFilter => activeFilter.category === 'Service Name')
      .map(activeFilter => activeFilter.value);

    if (namespacesSelected.length === 0) {
      API.GetNamespaces()
        .then(namespacesResponse => {
          const namespaces: Namespace[] = namespacesResponse['data'];
          this.fetchServices(namespaces.map(namespace => namespace.name), servicenameFilters);
        })
        .catch(namespacesError => {
          console.error(JSON.stringify(namespacesError));
          this.handleError('Error fetching namespace list.');
        });
    } else {
      this.fetchServices(namespacesSelected, servicenameFilters);
    }
  }

  fetchServices(namespaces: string[], servicenameFilters: string[]) {
    const promises = namespaces.map(ns => API.GetServices(ns));
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
              replicas: serviceName.replicas,
              available_replicas: serviceName.available_replicas,
              unavailable_replicas: serviceName.unavailable_replicas
            };
            updatedServices.push(serviceItem);
          });
        });
        if (servicenameFilters.length > 0) {
          updatedServices = this.filterServices(updatedServices, servicenameFilters);
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
        this.handleError(' Error fetching service list.');
      });
  }

  isFiltered(service: ServiceItem, servicenameFilters: string[]) {
    for (let i = 0; i < servicenameFilters.length; i++) {
      if (service.servicename.includes(servicenameFilters[i])) {
        return true;
      }
    }
    return false;
  }

  filterServices(services: ServiceItem[], servicenameFilters: string[]) {
    let filteredServices: ServiceItem[] = services.filter(service => this.isFiltered(service, servicenameFilters));
    return filteredServices;
  }

  sortServices(services: ServiceItem[], sortField: SortField, isAscending: boolean): ServiceItem[] {
    let sorted: ServiceItem[] = services.sort((a: ServiceItem, b: ServiceItem) => {
      let sortValue = -1;
      if (sortField.id === 'namespace') {
        sortValue = a.namespace.localeCompare(b.namespace);
        if (sortValue === 0) {
          sortValue = a.servicename.localeCompare(b.servicename);
        }
      } else {
        sortValue = a.servicename.localeCompare(b.servicename);
      }
      return isAscending ? sortValue : sortValue * -1;
    });
    return sorted;
  }

  render() {
    let serviceList: any = [];
    let pageStart = (this.state.pagination.page - 1) * this.state.pagination.perPage;
    let pageEnd = pageStart + this.state.pagination.perPage;
    pageEnd = pageEnd < this.state.services.length ? pageEnd : this.state.services.length;

    for (let i = pageStart; i < pageEnd; i++) {
      let serviceItem = this.state.services[i];
      let to = '/namespaces/' + serviceItem.namespace + '/services/' + serviceItem.servicename;
      let serviceDescriptor = (
        <Col>
          <strong>Pod status: </strong> {serviceItem.available_replicas} / {serviceItem.replicas}{' '}
          <Icon
            type="pf"
            name={
              serviceItem.available_replicas < serviceItem.replicas || serviceItem.replicas === 0
                ? 'warning-triangle-o'
                : 'ok'
            }
          />
        </Col>
      );

      serviceList.push(
        <Link key={to} to={to} style={{ color: 'black' }}>
          <ListViewItem
            leftContent={<ListViewIcon type="pf" name="service" />}
            heading={
              <span>
                {serviceItem.servicename}
                <small>{serviceItem.namespace}</small>
              </span>
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
            initialFilters={[serviceNameFilter]}
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
                isNumeric={false}
                isAscending={this.state.isSortAscending}
                onClick={this.updateSortDirection}
              />
            </Sort>
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
}

export default ServiceListComponent;
