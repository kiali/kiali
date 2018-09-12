import * as React from 'react';
import { AxiosError } from 'axios';
import {
  Button,
  Icon,
  ListView,
  ListViewIcon,
  ListViewItem,
  Paginator,
  Sort,
  ToolbarRightContent
} from 'patternfly-react';
import { Link } from 'react-router-dom';

import {
  defaultNamespaceFilter,
  NamespaceFilter,
  NamespaceFilterSelected
} from '../../components/NamespaceFilter/NamespaceFilter';
import { PfColors } from '../../components/Pf/PfColors';
import * as API from '../../services/Api';
import { getRequestErrorsRatio, ServiceHealth } from '../../types/Health';
import Namespace from '../../types/Namespace';
import { ActiveFilter, FILTER_ACTION_UPDATE, FilterType } from '../../types/NamespaceFilter';
import { Pagination } from '../../types/Pagination';
import { overviewToItem, ServiceItem, ServiceOverview, SortField } from '../../types/ServiceListComponent';
import { IstioLogo } from '../../config';
import { authentication } from '../../utils/Authentication';
import { removeDuplicatesArray } from '../../utils/Common';
import RateIntervalToolbarItem from './RateIntervalToolbarItem';
import ItemDescription from './ItemDescription';
import './ServiceListComponent.css';
import { URLParameter } from '../../types/Parameters';
import { ListPage } from '../../components/ListPage/ListPage';

type ServiceItemHealth = ServiceItem & { health: ServiceHealth };

// Exported for test
export const sortFields: SortField[] = [
  {
    title: 'Namespace',
    isNumeric: false,
    param: 'ns',
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
    param: 'sn',
    compare: (a: ServiceItem, b: ServiceItem) => a.name.localeCompare(b.name)
  },
  {
    title: 'Istio Sidecar',
    isNumeric: false,
    param: 'is',
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
    param: 'er',
    compare: (a: ServiceItemHealth, b: ServiceItemHealth) => {
      const ratioA = getRequestErrorsRatio(a.health.requests).value;
      const ratioB = getRequestErrorsRatio(b.health.requests).value;
      return ratioA === ratioB ? a.name.localeCompare(b.name) : ratioA - ratioB;
    }
  }
];

// Exported for test
export const sortServices = (
  services: ServiceItem[],
  sortField: SortField,
  isAscending: boolean
): Promise<ServiceItem[]> => {
  if (sortField.title === 'Error Rate') {
    // In the case of error rate sorting, we may not have all health promises ready yet
    // So we need to get them all before actually sorting
    const allHealthPromises: Promise<ServiceItemHealth>[] = services.map(item => {
      return item.healthPromise.then(health => {
        const withHealth: any = item;
        withHealth.health = health;
        return withHealth;
      });
    });
    return Promise.all(allHealthPromises).then(arr => {
      return arr.sort(isAscending ? sortField.compare : (a, b) => sortField.compare(b, a));
    });
  }
  // Default case: sorting is done synchronously
  const sorted = services.sort(isAscending ? sortField.compare : (a, b) => sortField.compare(b, a));
  return Promise.resolve(sorted);
};

const serviceNameFilter: FilterType = {
  id: 'servicename',
  title: 'Service Name',
  placeholder: 'Filter by Service Name',
  filterType: 'text',
  action: 'append',
  filterValues: []
};

const istioFilter: FilterType = {
  id: 'istio',
  title: 'Istio Sidecar',
  placeholder: 'Filter by Istio Sidecar',
  filterType: 'select',
  action: 'update',
  filterValues: [{ id: 'present', title: 'Present' }, { id: 'not_present', title: 'Not Present' }]
};

const availableFilters: FilterType[] = [serviceNameFilter, istioFilter, defaultNamespaceFilter];

type ServiceListComponentState = {
  services: ServiceItem[];
  pagination: Pagination;
  currentSortField: SortField;
  isSortAscending: boolean;
  rateInterval: number;
};

type ServiceListComponentProps = {
  pageHooks: ListPage.Hooks;
  pagination: Pagination;
  currentSortField: SortField;
  isSortAscending: boolean;
  rateInterval: number;
};

class ServiceListComponent extends React.Component<ServiceListComponentProps, ServiceListComponentState> {
  constructor(props: ServiceListComponentProps) {
    super(props);

    this.state = {
      services: [],
      pagination: this.props.pagination,
      currentSortField: this.props.currentSortField,
      isSortAscending: this.props.isSortAscending,
      rateInterval: this.props.rateInterval
    };

    this.setActiveFiltersToURL();
  }

  componentDidMount() {
    this.updateServices();
  }

  componentDidUpdate(prevProps: ServiceListComponentProps, prevState: ServiceListComponentState, snapshot: any) {
    if (!this.paramsAreSynced(prevProps)) {
      this.setState({
        pagination: this.props.pagination,
        currentSortField: this.props.currentSortField,
        isSortAscending: this.props.isSortAscending,
        rateInterval: this.props.rateInterval
      });

      NamespaceFilterSelected.setSelected(this.selectedFilters());
      this.updateServices();
    }
  }

  paramsAreSynced(prevProps: ServiceListComponentProps) {
    return (
      prevProps.pagination.page === this.props.pagination.page &&
      prevProps.pagination.perPage === this.props.pagination.perPage &&
      prevProps.rateInterval === this.props.rateInterval &&
      prevProps.isSortAscending === this.props.isSortAscending &&
      prevProps.currentSortField.title === this.props.currentSortField.title &&
      this.filtersMatch()
    );
  }

  filtersMatch() {
    const selectedFilters: Map<string, string[]> = new Map<string, string[]>();

    NamespaceFilterSelected.getSelected().map(activeFilter => {
      const existingValue = selectedFilters.get(activeFilter.category) || [];
      selectedFilters.set(activeFilter.category, existingValue.concat(activeFilter.value));
    });

    let urlParams: Map<string, string[]> = new Map<string, string[]>();
    availableFilters.forEach(filter => {
      const param = this.props.pageHooks.getQueryParam(filter.id);
      if (param !== undefined) {
        const existing = urlParams.get(filter.title) || [];
        urlParams.set(filter.title, existing.concat(param));
      }
    });

    let equalFilters = true;
    selectedFilters.forEach((filterValues, filterName) => {
      const aux = urlParams.get(filterName) || [];
      equalFilters =
        equalFilters && filterValues.every(value => aux.includes(value)) && filterValues.length === aux.length;
    });

    return selectedFilters.size === urlParams.size && equalFilters;
  }

  setActiveFiltersToURL() {
    const params = NamespaceFilterSelected.getSelected()
      .map(activeFilter => {
        const availableFilter = availableFilters.find(filter => {
          return filter.title === activeFilter.category;
        });

        if (typeof availableFilter === 'undefined') {
          NamespaceFilterSelected.setSelected(
            NamespaceFilterSelected.getSelected().filter(nfs => {
              return nfs.category !== activeFilter.category;
            })
          );
          return null;
        }

        return {
          name: availableFilter.id,
          value: activeFilter.value
        };
      })
      .filter(filter => filter !== null) as URLParameter[];

    this.props.pageHooks.onParamChange(params, 'append', 'replace');
  }

  selectedFilters() {
    let activeFilters: ActiveFilter[] = [];
    availableFilters.forEach(filter => {
      (this.props.pageHooks.getQueryParam(filter.id) || []).forEach(value => {
        activeFilters = activeFilters.concat({
          label: filter.title + ': ' + value,
          category: filter.title,
          value: value
        });
      });
    });

    return activeFilters;
  }

  onFilterChange = (filters: ActiveFilter[]) => {
    let params: URLParameter[] = [];

    availableFilters.forEach(availableFilter => {
      params.push({ name: availableFilter.id, value: '' });
    });

    filters.forEach(activeFilter => {
      let filterId = (
        availableFilters.find(filter => {
          return filter.title === activeFilter.category;
        }) || availableFilters[2]
      ).id;

      const updateableFilterIds = availableFilters
        .filter(filter => filter.action === FILTER_ACTION_UPDATE)
        .map(filter => filter.id);

      if (updateableFilterIds.includes(filterId)) {
        params = this.updateParams(params, filterId, activeFilter.value);
      } else {
        params.push({
          name: filterId,
          value: activeFilter.value
        });
      }
    });

    // Resetting pagination when filters change
    params.push({ name: 'page', value: '' });

    this.props.pageHooks.onParamChange(params, 'append');
    this.updateServices(true);
  };

  updateParams(params: URLParameter[], id: string, value: string) {
    let newParams = params;
    const index = newParams.findIndex(param => param.name === id && param.value.length > 0);
    if (index >= 0) {
      newParams[index].value = value;
    } else {
      newParams.push({
        name: id,
        value: value
      });
    }
    return newParams;
  }

  handleError = (error: string) => {
    this.props.pageHooks.handleError(error);
  };

  handleAxiosError(message: string, error: AxiosError) {
    const errMsg = API.getErrorMsg(message, error);
    console.error(errMsg);
    this.handleError(errMsg);
  }

  pageSet = (page: number) => {
    this.setState(prevState => {
      return {
        services: prevState.services,
        pagination: {
          page: page,
          perPage: prevState.pagination.perPage,
          perPageOptions: ListPage.perPageOptions
        }
      };
    });

    this.props.pageHooks.onParamChange([{ name: 'page', value: String(page) }]);
  };

  perPageSelect = (perPage: number) => {
    this.setState(prevState => {
      return {
        services: prevState.services,
        pagination: {
          page: 1,
          perPage: perPage,
          perPageOptions: ListPage.perPageOptions
        }
      };
    });

    this.props.pageHooks.onParamChange([{ name: 'page', value: '1' }, { name: 'perPage', value: String(perPage) }]);
  };

  updateSortField = (sortField: SortField) => {
    sortServices(this.state.services, sortField, this.state.isSortAscending).then(sorted => {
      this.setState({
        currentSortField: sortField,
        services: sorted
      });

      this.props.pageHooks.onParamChange([{ name: 'sort', value: sortField.param }]);
    });
  };

  updateSortDirection = () => {
    sortServices(this.state.services, this.state.currentSortField, !this.state.isSortAscending).then(sorted => {
      this.setState({
        isSortAscending: !this.state.isSortAscending,
        services: sorted
      });

      this.props.pageHooks.onParamChange([{ name: 'direction', value: this.state.isSortAscending ? 'asc' : 'desc' }]);
    });
  };

  updateServices = (resetPagination?: boolean) => {
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

    /** Remove Duplicates */
    namespacesSelected = removeDuplicatesArray(namespacesSelected);
    servicenameFilters = removeDuplicatesArray(servicenameFilters);
    istioFilters = this.cleanIstioFilters(removeDuplicatesArray(istioFilters));

    if (namespacesSelected.length === 0) {
      API.getNamespaces(authentication())
        .then(namespacesResponse => {
          const namespaces: Namespace[] = namespacesResponse['data'];
          this.fetchServices(
            namespaces.map(namespace => namespace.name),
            servicenameFilters,
            istioFilters,
            resetPagination
          );
        })
        .catch(namespacesError => this.handleAxiosError('Could not fetch namespace list.', namespacesError));
    } else {
      this.fetchServices(namespacesSelected, servicenameFilters, istioFilters, resetPagination);
    }
  };

  fetchServices(namespaces: string[], servicenameFilters: string[], istioFilters: string[], resetPagination?: boolean) {
    const promises = namespaces.map(ns => API.getServices(authentication(), ns));

    Promise.all(promises)
      .then(servicesResponse => {
        const currentPage = resetPagination ? 1 : this.state.pagination.page;
        let updatedServices: ServiceItem[] = [];
        servicesResponse.forEach(serviceResponse => {
          const namespace = serviceResponse.data.namespace.name;
          let serviceList = serviceResponse.data.services;
          if (servicenameFilters.length > 0 || istioFilters.length > 0) {
            serviceList = serviceList.filter(service => this.isFiltered(service, servicenameFilters, istioFilters));
          }
          serviceList.forEach(overview => {
            const healthProm = API.getServiceHealth(
              authentication(),
              namespace,
              overview.name,
              this.state.rateInterval
            );
            updatedServices.push(overviewToItem(overview, namespace, healthProm));
          });
        });
        sortServices(updatedServices, this.state.currentSortField, this.state.isSortAscending).then(sorted => {
          this.setState({
            services: sorted,
            pagination: {
              page: currentPage,
              perPage: this.state.pagination.perPage,
              perPageOptions: ListPage.perPageOptions
            }
          });
        });
      })
      .catch(servicesError => this.handleAxiosError('Could not fetch service list.', servicesError));
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

  isFiltered(service: ServiceOverview, servicenameFilters: string[], istioFilters: string[]) {
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
      if (istioFilters[0] === 'Present') {
        istioFiltered = service.istioSidecar;
      }
      if (istioFilters[0] === 'Not Present') {
        istioFiltered = !service.istioSidecar;
      }
    }

    return serviceNameFiltered && istioFiltered;
  }

  render() {
    let serviceList: any = [];
    let pageStart = (this.state.pagination.page - 1) * this.state.pagination.perPage;
    let pageEnd = pageStart + this.state.pagination.perPage;
    pageEnd = pageEnd < this.state.services.length ? pageEnd : this.state.services.length;

    for (let i = pageStart; i < pageEnd; i++) {
      const serviceItem = this.state.services[i];
      const to = '/namespaces/' + serviceItem.namespace + '/services/' + serviceItem.name;

      serviceList.push(
        <Link key={to} to={to} style={{ color: PfColors.Black }}>
          <ListViewItem
            leftContent={<ListViewIcon type="pf" name="service" />}
            heading={
              <div className="ServiceList-Heading">
                <div className="ServiceList-IstioLogo">
                  {serviceItem.istioSidecar && <img className="IstioLogo" src={IstioLogo} alt="Istio sidecar" />}
                </div>
                <div className="ServiceList-Title">
                  {serviceItem.name}
                  <small>{serviceItem.namespace}</small>
                </div>
              </div>
            }
            // Prettier makes irrelevant line-breaking clashing with tslint
            // prettier-ignore
            description={<ItemDescription item={serviceItem} />}
          />
        </Link>
      );
    }
    return (
      <div>
        <NamespaceFilter
          initialFilters={[serviceNameFilter, istioFilter]}
          initialActiveFilters={this.selectedFilters()}
          onFilterChange={this.onFilterChange}
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
          <ToolbarRightContent>
            <Button onClick={this.updateServices}>
              <Icon name="refresh" />
            </Button>
          </ToolbarRightContent>
        </NamespaceFilter>
        <ListView>{serviceList}</ListView>
        <Paginator
          viewType="list"
          pagination={this.state.pagination}
          itemCount={this.state.services.length}
          onPageSet={this.pageSet}
          onPerPageSelect={this.perPageSelect}
        />
      </div>
    );
  }

  private rateIntervalChangedHandler = (key: number) => {
    this.setState({ rateInterval: key });
    this.props.pageHooks.onParamChange([{ name: 'rate', value: String(key) }]);
    this.updateServices();
  };
}

export default ServiceListComponent;
