import * as React from 'react';
import { ListView, ListViewItem, ListViewIcon, Sort } from 'patternfly-react';
import { Link } from 'react-router-dom';
import { ServiceFilter, ServiceFilterSelected } from '../../components/ServiceFilter/ServiceFilter';
import { Paginator } from 'patternfly-react';
import { ActiveFilter } from '../../types/ServiceFilter';
import * as API from '../../services/Api';
import { Namespace } from '../../types/Namespace';
import { Pagination, ServiceItem, ServiceList } from '../../types/ServiceListComponent';
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
      pagination: { page: 1, perPage: 10, perPageOptions: [5, 10, 15] },
      currentSortField: sortFields[0],
      isSortAscending: true
    };
  }

  componentWillMount() {
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
          perPageOptions: prevState.pagination.perPageOptions
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
          perPageOptions: prevState.pagination.perPageOptions
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
    const activeFilters: ActiveFilter[] = ServiceFilterSelected.getSelected();
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
              servicename: serviceName.name
            };
            updatedServices.push(serviceItem);
          });
        });
        if (servicenameFilters.length > 0) {
          updatedServices = this.filterServices(updatedServices, servicenameFilters);
        }
        updatedServices = this.sortServices(updatedServices, this.state.currentSortField, this.state.isSortAscending);
        this.setState({
          loading: false,
          services: updatedServices
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
            description={<span />}
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
          <ServiceFilter onFilterChange={this.filterChange} onError={this.handleError}>
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
          </ServiceFilter>
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
