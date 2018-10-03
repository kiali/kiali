import * as React from 'react';
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
import { FilterSelected, StatefulFilters } from '../../components/Filters/StatefulFilters';
import { PfColors } from '../../components/Pf/PfColors';
import * as API from '../../services/Api';
import Namespace from '../../types/Namespace';
import { ActiveFilter } from '../../types/Filters';
import { ServiceList, ServiceListItem } from '../../types/ServiceList';
import { IstioLogo } from '../../config';
import { authentication } from '../../utils/Authentication';
import { removeDuplicatesArray } from '../../utils/Common';
import RateIntervalToolbarItem from './RateIntervalToolbarItem';
import ItemDescription from './ItemDescription';
import { ListPage } from '../../components/ListPage/ListPage';
import { ServiceListFilters } from './FiltersAndSorts';

import './ServiceListComponent.css';
import { SortField } from '../../types/SortFilters';
import { ListComponent } from '../../components/ListPage/ListComponent';

interface ServiceListComponentState extends ListComponent.State<ServiceListItem> {
  rateInterval: number;
}

interface ServiceListComponentProps extends ListComponent.Props<ServiceListItem> {
  rateInterval: number;
}

class ServiceListComponent extends ListComponent.Component<
  ServiceListComponentProps,
  ServiceListComponentState,
  ServiceListItem
> {
  constructor(props: ServiceListComponentProps) {
    super(props);

    this.state = {
      listItems: [],
      pagination: this.props.pagination,
      currentSortField: this.props.currentSortField,
      isSortAscending: this.props.isSortAscending,
      rateInterval: this.props.rateInterval
    };
  }

  componentDidMount() {
    this.updateListItems();
  }

  componentDidUpdate(prevProps: ServiceListComponentProps, prevState: ServiceListComponentState, snapshot: any) {
    if (!this.paramsAreSynced(prevProps)) {
      this.setState({
        pagination: this.props.pagination,
        currentSortField: this.props.currentSortField,
        isSortAscending: this.props.isSortAscending,
        rateInterval: this.props.rateInterval
      });

      this.updateListItems();
    }
  }

  paramsAreSynced(prevProps: ServiceListComponentProps) {
    return (
      prevProps.pagination.page === this.props.pagination.page &&
      prevProps.pagination.perPage === this.props.pagination.perPage &&
      prevProps.rateInterval === this.props.rateInterval &&
      prevProps.isSortAscending === this.props.isSortAscending &&
      prevProps.currentSortField.title === this.props.currentSortField.title
    );
  }

  rateIntervalChangedHandler = (key: number) => {
    this.setState({ rateInterval: key });
    this.props.pageHooks.onParamChange([{ name: 'rate', value: String(key) }]);
    this.updateListItems();
  };

  sortItemList(services: ServiceListItem[], sortField: SortField<ServiceListItem>, isAscending: boolean) {
    return ServiceListFilters.sortServices(services, sortField, isAscending);
  }

  updateListItems(resetPagination?: boolean) {
    const activeFilters: ActiveFilter[] = FilterSelected.getSelected();
    let namespacesSelected: string[] = activeFilters
      .filter(activeFilter => activeFilter.category === 'Namespace')
      .map(activeFilter => activeFilter.value);

    /** Remove Duplicates */
    namespacesSelected = removeDuplicatesArray(namespacesSelected);

    if (namespacesSelected.length === 0) {
      API.getNamespaces(authentication())
        .then(namespacesResponse => {
          const namespaces: Namespace[] = namespacesResponse['data'];
          this.fetchServices(
            namespaces.map(namespace => namespace.name),
            activeFilters,
            this.state.rateInterval,
            resetPagination
          );
        })
        .catch(namespacesError => this.handleAxiosError('Could not fetch namespace list.', namespacesError));
    } else {
      this.fetchServices(namespacesSelected, activeFilters, this.state.rateInterval, resetPagination);
    }
  }

  getServiceItem(data: ServiceList, rateInterval: number): ServiceListItem[] {
    let serviceItems: ServiceListItem[] = [];
    if (data.services) {
      data.services.forEach(service => {
        const healthProm = API.getServiceHealth(authentication(), data.namespace.name, service.name, rateInterval);
        serviceItems.push({
          name: service.name,
          istioSidecar: service.istioSidecar,
          namespace: data.namespace.name,
          healthPromise: healthProm
        });
      });
    }
    return serviceItems;
  }

  fetchServices(namespaces: string[], filters: ActiveFilter[], rateInterval: number, resetPagination?: boolean) {
    const servicesPromises = namespaces.map(ns => API.getServices(authentication(), ns));

    Promise.all(servicesPromises).then(responses => {
      const currentPage = resetPagination ? 1 : this.state.pagination.page;

      let serviceListItems: ServiceListItem[] = [];
      responses.forEach(response => {
        serviceListItems = serviceListItems.concat(
          ServiceListFilters.filterBy(this.getServiceItem(response.data, rateInterval), filters)
        );
      });

      ServiceListFilters.sortServices(serviceListItems, this.state.currentSortField, this.state.isSortAscending).then(
        sorted => {
          this.setState(prevState => {
            return {
              listItems: sorted,
              pagination: {
                page: currentPage,
                perPage: prevState.pagination.perPage,
                perPageOptions: ListPage.perPageOptions
              }
            };
          });
        }
      );
    });
  }

  render() {
    let serviceList: any = [];
    let pageStart = (this.state.pagination.page - 1) * this.state.pagination.perPage;
    let pageEnd = pageStart + this.state.pagination.perPage;
    pageEnd = pageEnd < this.state.listItems.length ? pageEnd : this.state.listItems.length;

    for (let i = pageStart; i < pageEnd; i++) {
      const serviceItem = this.state.listItems[i];
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
        <StatefulFilters
          initialFilters={ServiceListFilters.availableFilters}
          pageHooks={this.props.pageHooks}
          onFilterChange={this.onFilterChange}
        >
          <Sort>
            <Sort.TypeSelector
              sortTypes={ServiceListFilters.sortFields}
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
            <Button onClick={this.updateListItems}>
              <Icon name="refresh" />
            </Button>
          </ToolbarRightContent>
        </StatefulFilters>
        <ListView>{serviceList}</ListView>
        <Paginator
          viewType="list"
          pagination={this.state.pagination}
          itemCount={this.state.listItems.length}
          onPageSet={this.pageSet}
          onPerPageSelect={this.perPageSelect}
        />
      </div>
    );
  }
}

export default ServiceListComponent;
