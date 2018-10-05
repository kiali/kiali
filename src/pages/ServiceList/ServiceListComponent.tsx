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
import { CancelablePromise, makeCancelablePromise, removeDuplicatesArray } from '../../utils/Common';
import RateIntervalToolbarItem from './RateIntervalToolbarItem';
import ItemDescription from './ItemDescription';
import { ListPage } from '../../components/ListPage/ListPage';
import { ServiceListFilters } from './FiltersAndSorts';

import './ServiceListComponent.css';
import { SortField } from '../../types/SortFilters';
import { ListComponent } from '../../components/ListPage/ListComponent';
import { HistoryManager, URLParams } from '../../app/History';

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
  private nsPromise?: CancelablePromise<API.Response<Namespace[]>>;
  private servicesPromise?: CancelablePromise<API.Response<ServiceList>[]>;
  private sortPromise?: CancelablePromise<ServiceListItem[]>;

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

  componentWillUnmount() {
    this.cancelAsyncs();
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
    HistoryManager.setParam(URLParams.DURATION, String(key));
    this.setState({ rateInterval: key });
  };

  sortItemList(services: ServiceListItem[], sortField: SortField<ServiceListItem>, isAscending: boolean) {
    let lastSort: Promise<ServiceListItem[]>;
    const sorter = unsorted => {
      this.sortPromise = makeCancelablePromise(ServiceListFilters.sortServices(services, sortField, isAscending));
      this.sortPromise.promise
        .then(() => {
          this.sortPromise = undefined;
        })
        .catch(() => {
          this.sortPromise = undefined;
        });
      return this.sortPromise.promise;
    };

    if (!this.sortPromise) {
      // If there is no "sortPromise" set, take the received (unsorted) list of services to sort
      // them and update the UI with the sorted list.
      lastSort = sorter(services);
    } else {
      // If there is a "sortPromise", there may be an ongoing fetch/refresh. So, the received <services> list argument
      // shoudn't be used as it may represent the "old" data before the refresh. Instead, append a callback to the
      // "sortPromise" to re-sort once the data is fetched. This ensures that the list will display the new data with
      // the right sorting.
      // (See other comments in the fetchServices method)
      lastSort = this.sortPromise.promise.then(sorter);
    }

    return lastSort;
  }

  updateListItems(resetPagination?: boolean) {
    this.cancelAsyncs();

    const activeFilters: ActiveFilter[] = FilterSelected.getSelected();
    let namespacesSelected: string[] = activeFilters
      .filter(activeFilter => activeFilter.category === 'Namespace')
      .map(activeFilter => activeFilter.value);

    /** Remove Duplicates */
    namespacesSelected = removeDuplicatesArray(namespacesSelected);

    if (namespacesSelected.length === 0) {
      this.nsPromise = makeCancelablePromise(API.getNamespaces(authentication()));
      this.nsPromise.promise
        .then(namespacesResponse => {
          const namespaces: Namespace[] = namespacesResponse['data'];
          this.fetchServices(
            namespaces.map(namespace => namespace.name),
            activeFilters,
            this.state.rateInterval,
            resetPagination
          );
          this.nsPromise = undefined;
        })
        .catch(namespacesError => {
          if (!namespacesError.isCanceled) {
            this.handleAxiosError('Could not fetch namespace list.', namespacesError);
          }
        });
    } else {
      this.fetchServices(namespacesSelected, activeFilters, this.state.rateInterval, resetPagination);
    }
  }

  getServiceItem(data: ServiceList, rateInterval: number): ServiceListItem[] {
    if (data.services) {
      return data.services.map(service => ({
        name: service.name,
        istioSidecar: service.istioSidecar,
        namespace: data.namespace.name,
        healthPromise: API.getServiceHealth(authentication(), data.namespace.name, service.name, rateInterval)
      }));
    }
    return [];
  }

  fetchServices(namespaces: string[], filters: ActiveFilter[], rateInterval: number, resetPagination?: boolean) {
    const servicesPromises = namespaces.map(ns => API.getServices(authentication(), ns));

    this.servicesPromise = makeCancelablePromise(Promise.all(servicesPromises));
    this.servicesPromise.promise
      .then(responses => {
        const currentPage = resetPagination ? 1 : this.state.pagination.page;

        let serviceListItems: ServiceListItem[] = [];
        responses.forEach(response => {
          ServiceListFilters.filterBy(response.data, filters);
          serviceListItems = serviceListItems.concat(this.getServiceItem(response.data, rateInterval));
        });
        if (this.sortPromise) {
          this.sortPromise.cancel();
        }
        // Promises for sorting are needed, because the user may have the list sorted using health/error rates
        // and these data can be fetched only after the list is retrieved. If the user is sorting using these
        // criteria, the update of the list is deferred after sorting is possible. This way, it's avoided the
        // illusion of double-fetch or flickering list.
        this.sortPromise = makeCancelablePromise(
          ServiceListFilters.sortServices(serviceListItems, this.state.currentSortField, this.state.isSortAscending)
        );
        this.sortPromise.promise
          .then(sorted => {
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
            this.sortPromise = undefined;
          })
          .catch(err => {
            if (!err.isCanceled) {
              console.debug(err);
            }
            this.sortPromise = undefined;
          });
        this.servicesPromise = undefined;
      })
      .catch(err => {
        if (!err.isCanceled) {
          console.debug(err);
        }
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

  private cancelAsyncs = () => {
    if (this.nsPromise) {
      this.nsPromise.cancel();
      this.nsPromise = undefined;
    }
    if (this.servicesPromise) {
      this.servicesPromise.cancel();
      this.servicesPromise = undefined;
    }
    if (this.sortPromise) {
      this.sortPromise.cancel();
      this.sortPromise = undefined;
    }
  };
}

export default ServiceListComponent;
