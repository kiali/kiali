import * as React from 'react';
import { connect } from 'react-redux';
import { ListView, ListViewIcon, ListViewItem, Paginator, Sort, ToolbarRightContent } from 'patternfly-react';
import { Link } from 'react-router-dom';
import { FilterSelected, StatefulFilters } from '../../components/Filters/StatefulFilters';
import { PfColors } from '../../components/Pf/PfColors';
import * as API from '../../services/Api';
import Namespace from '../../types/Namespace';
import { ActiveFilter } from '../../types/Filters';
import { ServiceList, ServiceListItem } from '../../types/ServiceList';
import { PromisesRegistry } from '../../utils/CancelablePromises';
import ItemDescription from './ItemDescription';
import * as ListPagesHelper from '../../components/ListPage/ListPagesHelper';
import * as ServiceListFilters from './FiltersAndSorts';
import './ServiceListComponent.css';
import { SortField } from '../../types/SortFilters';
import * as ListComponent from '../../components/ListPage/ListComponent';
import { AlignRightStyle, ThinStyle } from '../../components/Filters/FilterStyles';
import { arrayEquals } from '../../utils/Common';
import { KialiAppState } from '../../store/Store';
import { activeNamespacesSelector, durationSelector } from '../../store/Selectors';
import { DurationInSeconds } from '../../types/Common';
import { DurationDropdownContainer } from '../../components/DurationDropdown/DurationDropdown';
import RefreshButtonContainer from '../../components/Refresh/RefreshButton';
import { ObjectValidation, Validations } from '../../types/IstioObjects';

type ServiceListComponentState = ListComponent.State<ServiceListItem>;

type ReduxProps = {
  duration: DurationInSeconds;
  activeNamespaces: Namespace[];
};

type ServiceListComponentProps = ReduxProps & ListComponent.Props<ServiceListItem>;

class ServiceListComponent extends ListComponent.Component<
  ServiceListComponentProps,
  ServiceListComponentState,
  ServiceListItem
> {
  private promises = new PromisesRegistry();

  constructor(props: ServiceListComponentProps) {
    super(props);

    this.state = {
      listItems: [],
      pagination: this.props.pagination,
      currentSortField: this.props.currentSortField,
      isSortAscending: this.props.isSortAscending
    };
  }

  componentDidMount() {
    this.updateListItems();
  }

  componentDidUpdate(prevProps: ServiceListComponentProps, _prevState: ServiceListComponentState, _snapshot: any) {
    if (!this.paramsAreSynced(prevProps)) {
      this.setState({
        pagination: this.props.pagination,
        currentSortField: this.props.currentSortField,
        isSortAscending: this.props.isSortAscending
      });

      this.updateListItems();
    }
  }

  componentWillUnmount() {
    this.promises.cancelAll();
  }

  paramsAreSynced(prevProps: ServiceListComponentProps) {
    const activeNamespacesCompare = arrayEquals(
      prevProps.activeNamespaces,
      this.props.activeNamespaces,
      (n1, n2) => n1.name === n2.name
    );
    return (
      prevProps.pagination.page === this.props.pagination.page &&
      prevProps.pagination.perPage === this.props.pagination.perPage &&
      prevProps.duration === this.props.duration &&
      activeNamespacesCompare &&
      prevProps.isSortAscending === this.props.isSortAscending &&
      prevProps.currentSortField.title === this.props.currentSortField.title
    );
  }

  sortItemList(services: ServiceListItem[], sortField: SortField<ServiceListItem>, isAscending: boolean) {
    // Chain promises, as there may be an ongoing fetch/refresh and sort can be called after UI interaction
    // This ensures that the list will display the new data with the right sorting
    return this.promises.registerChained('sort', services, unsorted =>
      ServiceListFilters.sortServices(unsorted, sortField, isAscending)
    );
  }

  updateListItems(resetPagination?: boolean) {
    this.promises.cancelAll();

    const activeFilters: ActiveFilter[] = FilterSelected.getSelected();
    const namespacesSelected = this.props.activeNamespaces.map(item => item.name);

    if (namespacesSelected.length === 0) {
      this.promises
        .register('namespaces', API.getNamespaces())
        .then(namespacesResponse => {
          const namespaces: Namespace[] = namespacesResponse.data;
          this.fetchServices(
            namespaces.map(namespace => namespace.name),
            activeFilters,
            this.props.duration,
            resetPagination
          );
        })
        .catch(namespacesError => {
          if (!namespacesError.isCanceled) {
            this.handleAxiosError('Could not fetch namespace list', namespacesError);
          }
        });
    } else {
      this.fetchServices(namespacesSelected, activeFilters, this.props.duration, resetPagination);
    }
  }

  getServiceItem(data: ServiceList, rateInterval: number): ServiceListItem[] {
    if (data.services) {
      return data.services.map(service => ({
        name: service.name,
        istioSidecar: service.istioSidecar,
        namespace: data.namespace.name,
        healthPromise: API.getServiceHealth(data.namespace.name, service.name, rateInterval, service.istioSidecar),
        validation: this.getServiceValidation(service.name, data.validations)
      }));
    }
    return [];
  }

  fetchServices(namespaces: string[], filters: ActiveFilter[], rateInterval: number, resetPagination?: boolean) {
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
        const currentPage = resetPagination ? 1 : this.state.pagination.page;
        this.promises.cancel('sort');
        this.sortItemList(serviceListItems, this.state.currentSortField, this.state.isSortAscending)
          .then(sorted => {
            this.setState(prevState => {
              return {
                listItems: sorted,
                pagination: {
                  page: currentPage,
                  perPage: prevState.pagination.perPage,
                  perPageOptions: ListPagesHelper.perPageOptions
                }
              };
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
    const serviceList: React.ReactElement<{}>[] = [];
    const pageStart = (this.state.pagination.page - 1) * this.state.pagination.perPage;
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
        <StatefulFilters initialFilters={ServiceListFilters.availableFilters} onFilterChange={this.onFilterChange}>
          <Sort style={{ ...ThinStyle }}>
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
          <ToolbarRightContent style={{ ...AlignRightStyle }}>
            <DurationDropdownContainer id="service-list-duration-dropdown" />
            <RefreshButtonContainer handleRefresh={this.updateListItems} />
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

const mapStateToProps = (state: KialiAppState) => ({
  activeNamespaces: activeNamespacesSelector(state),
  duration: durationSelector(state)
});

const ServiceListComponentContainer = connect(mapStateToProps)(ServiceListComponent);
export default ServiceListComponentContainer;
