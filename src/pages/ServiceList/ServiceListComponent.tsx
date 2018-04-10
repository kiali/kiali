import * as React from 'react';
import { Icon, ListView, ListViewItem, ListViewIcon, Sort, DropdownButton, MenuItem } from 'patternfly-react';
import { Link } from 'react-router-dom';
import { NamespaceFilter, NamespaceFilterSelected } from '../../components/NamespaceFilter/NamespaceFilter';
import { Paginator } from 'patternfly-react';
import { ActiveFilter, FilterType } from '../../types/NamespaceFilter';
import * as API from '../../services/Api';
import Namespace from '../../types/Namespace';
import { Pagination } from '../../types/Pagination';
import { ServiceItem, ServiceList } from '../../types/ServiceListComponent';
import PropTypes from 'prop-types';
import MetricsOptionsBar from '../../components/MetricsOptions/MetricsOptionsBar';

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
const WARNING_THRESHOLD = 0.0;
const ERROR_THRESHOLD = 0.2;

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

    if (namespacesSelected.length === 0) {
      API.GetNamespaces()
        .then(namespacesResponse => {
          const namespaces: Namespace[] = namespacesResponse['data'];
          this.fetchServices(namespaces.map(namespace => namespace.name), servicenameFilters, rateInterval);
        })
        .catch(namespacesError => {
          console.error(JSON.stringify(namespacesError));
          this.handleError(API.GetErrorMsg('Could not fetch namespace list.', namespacesError));
        });
    } else {
      this.fetchServices(namespacesSelected, servicenameFilters);
    }
  }

  fetchServices(namespaces: string[], servicenameFilters: string[], rateInterval?: string) {
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
              replicas: serviceName.replicas,
              available_replicas: serviceName.available_replicas,
              unavailable_replicas: serviceName.unavailable_replicas,
              request_count: serviceName.request_count,
              request_error_count: serviceName.request_error_count,
              error_rate: serviceName.error_rate
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
        this.handleError(API.GetErrorMsg('Could not fetch service list.', servicesError));
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
        if (sortField.isNumeric) {
          // Right now, "Error Rate" is the only numeric filter.
          if (a[sortField.id] > b[sortField.id]) {
            sortValue = 1;
          } else if (a[sortField.id] < b[sortField.id]) {
            sortValue = -1;
          } else {
            sortValue = 0;
          }
        } else {
          sortValue = a[sortField.id].localeCompare(b[sortField.id]);
        }
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
        <table style={{ width: '30em', tableLayout: 'fixed' }}>
          <tr>
            <td>
              <strong>Pod status: </strong> {serviceItem.available_replicas} / {serviceItem.replicas}{' '}
              <Icon
                type="pf"
                name={
                  serviceItem.available_replicas < serviceItem.replicas || serviceItem.replicas === 0
                    ? 'warning-triangle-o'
                    : 'ok'
                }
              />
            </td>
            <td>
              <strong>Error rate: </strong>
              {serviceItem.request_count > 0 ? (serviceItem.error_rate * 100).toFixed(2) + '%' : '(No requests)'}&nbsp;
              <Icon
                type="pf"
                name={
                  serviceItem.error_rate > ERROR_THRESHOLD
                    ? 'error-circle-o'
                    : serviceItem.error_rate > WARNING_THRESHOLD ? 'warning-triangle-o' : 'ok'
                }
              />
            </td>
          </tr>
        </table>
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
      let rateIntervalSelected = MetricsOptionsBar.RateIntervals.find(el => {
        return el[0] === this.state.rateInterval;
      });

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
                isNumeric={this.state.currentSortField.isNumeric}
                isAscending={this.state.isSortAscending}
                onClick={this.updateSortDirection}
              />
            </Sort>
            <div className="form-group">
              <label>Rate Interval:&nbsp;</label>
              <DropdownButton
                title={'Last ' + rateIntervalSelected![1]}
                onSelect={this.rateIntervalChangedHandler}
                id="rateIntervalDropDown"
              >
                {MetricsOptionsBar.RateIntervals.map(r => (
                  <MenuItem key={r[0]} active={r[0] === this.state.rateInterval} eventKey={r[0]}>
                    Last {r[1]}
                  </MenuItem>
                ))}
              </DropdownButton>
            </div>
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
