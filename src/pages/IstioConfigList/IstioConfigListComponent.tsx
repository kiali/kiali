import * as React from 'react';
import { connect } from 'react-redux';
import { FilterSelected, StatefulFilters } from '../../components/Filters/StatefulFilters';
import { ActiveFilter } from '../../types/Filters';
import * as API from '../../services/Api';
import Namespace from '../../types/Namespace';
import {
  dicIstioType,
  filterByConfigValidation,
  filterByName,
  IstioConfigItem,
  toIstioItems
} from '../../types/IstioConfigList';
import { PromisesRegistry } from '../../utils/CancelablePromises';
import * as IstioConfigListFilters from './FiltersAndSorts';
import * as FilterComponent from '../../components/FilterList/FilterComponent';
import { SortField } from '../../types/SortFilters';
import { getFilterSelectedValues } from '../../components/Filters/CommonFilters';
import { namespaceEquals } from '../../utils/Common';
import { KialiAppState } from '../../store/Store';
import { activeNamespacesSelector } from '../../store/Selectors';
import RefreshButtonContainer from '../../components/Refresh/RefreshButton';
import { VirtualList } from '../../components/VirtualList/VirtualList';

interface IstioConfigListComponentState extends FilterComponent.State<IstioConfigItem> {}
interface IstioConfigListComponentProps extends FilterComponent.Props<IstioConfigItem> {
  activeNamespaces: Namespace[];
}

class IstioConfigListComponent extends FilterComponent.Component<
  IstioConfigListComponentProps,
  IstioConfigListComponentState,
  IstioConfigItem
> {
  private promises = new PromisesRegistry();

  constructor(props: IstioConfigListComponentProps) {
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

  componentDidUpdate(
    prevProps: IstioConfigListComponentProps,
    _prevState: IstioConfigListComponentState,
    _snapshot: any
  ) {
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

  paramsAreSynced = (prevProps: IstioConfigListComponentProps): [boolean, boolean] => {
    const activeNamespacesCompare = namespaceEquals(prevProps.activeNamespaces, this.props.activeNamespaces);
    const paramsSynced =
      activeNamespacesCompare &&
      prevProps.isSortAscending === this.props.isSortAscending &&
      prevProps.currentSortField.title === this.props.currentSortField.title;
    return [paramsSynced, activeNamespacesCompare];
  };

  sortItemList(apps: IstioConfigItem[], sortField: SortField<IstioConfigItem>, isAscending: boolean) {
    return IstioConfigListFilters.sortIstioItems(apps, sortField, isAscending);
  }

  updateListItems() {
    this.promises.cancelAll();

    const activeFilters: ActiveFilter[] = FilterSelected.getSelected();
    const namespacesSelected = this.props.activeNamespaces.map(item => item.name);
    const istioTypeFilters = getFilterSelectedValues(IstioConfigListFilters.istioTypeFilter, activeFilters).map(
      value => dicIstioType[value]
    );
    const istioNameFilters = getFilterSelectedValues(IstioConfigListFilters.istioNameFilter, activeFilters);
    const configValidationFilters = getFilterSelectedValues(
      IstioConfigListFilters.configValidationFilter,
      activeFilters
    );

    if (namespacesSelected.length === 0) {
      this.promises
        .register('namespaces', API.getNamespaces())
        .then(namespacesResponse => {
          const namespaces: Namespace[] = namespacesResponse.data;
          this.fetchConfigs(
            namespaces.map(namespace => namespace.name),
            istioTypeFilters,
            istioNameFilters,
            configValidationFilters
          );
        })
        .catch(namespacesError => {
          if (!namespacesError.isCanceled) {
            this.handleAxiosError('Could not fetch namespace list', namespacesError);
          }
        });
    } else {
      this.fetchConfigs(namespacesSelected, istioTypeFilters, istioNameFilters, configValidationFilters);
    }
  }

  fetchConfigs(
    namespaces: string[],
    istioTypeFilters: string[],
    istioNameFilters: string[],
    configValidationFilters: string[]
  ) {
    const configsPromises = this.fetchIstioConfigs(namespaces, istioTypeFilters, istioNameFilters);

    configsPromises
      .then(items =>
        IstioConfigListFilters.sortIstioItems(items, this.state.currentSortField, this.state.isSortAscending)
      )
      .then(configItems => filterByConfigValidation(configItems, configValidationFilters))
      .then(sorted => {
        // Update the view when data is fetched
        this.setState({
          listItems: sorted
        });
      })
      .catch(istioError => {
        console.log(istioError);
        if (!istioError.isCanceled) {
          this.handleAxiosError('Could not fetch Istio objects list', istioError);
        }
      });
  }

  // Fetch the Istio configs, apply filters and map them into flattened list items
  fetchIstioConfigs(namespaces: string[], typeFilters: string[], istioNameFilters: string[]) {
    return this.promises
      .registerAll('configs', namespaces.map(ns => API.getIstioConfig(ns, typeFilters, true)))
      .then(responses => {
        let istioItems: IstioConfigItem[] = [];
        responses.forEach(response => {
          istioItems = istioItems.concat(toIstioItems(filterByName(response.data, istioNameFilters)));
        });
        return istioItems;
      });
  }

  render() {
    return (
      <VirtualList rows={this.state.listItems} scrollFilters={false} updateItems={this.updateListItems}>
        <StatefulFilters
          initialFilters={IstioConfigListFilters.availableFilters}
          onFilterChange={this.onFilterChange}
          rightToolbar={[<RefreshButtonContainer key={'Refresh'} handleRefresh={this.updateListItems} />]}
        />
      </VirtualList>
    );
  }
}

const mapStateToProps = (state: KialiAppState) => ({
  activeNamespaces: activeNamespacesSelector(state)
});

const IstioConfigListContainer = connect(
  mapStateToProps,
  null
)(IstioConfigListComponent);
export default IstioConfigListContainer;
