import * as React from 'react';
import * as FilterHelper from '../../components/FilterList/FilterHelper';
import { RenderContent } from '../../components/Nav/Page';
import * as IstioConfigListFilters from './FiltersAndSorts';
import * as FilterComponent from '../../components/FilterList/FilterComponent';
import {
  dicIstioType,
  filterByConfigValidation,
  filterByName,
  IstioConfigItem,
  toIstioItems
} from '../../types/IstioConfigList';
import Namespace from '../../types/Namespace';
import { PromisesRegistry } from '../../utils/CancelablePromises';
import { namespaceEquals } from '../../utils/Common';
import { SortField } from '../../types/SortFilters';
import { ActiveFiltersInfo } from '../../types/Filters';
import { FilterSelected, StatefulFilters } from '../../components/Filters/StatefulFilters';
import { getFilterSelectedValues } from '../../components/Filters/CommonFilters';
import * as API from '../../services/Api';
import { ObjectValidation } from '../../types/IstioObjects';
import { showInMessageCenter } from '../../utils/IstioValidationUtils';
import VirtualList from '../../components/VirtualList/VirtualList';
import RefreshButtonContainer from '../../components/Refresh/RefreshButton';
import IstioActionsNamespaceDropdown from '../../components/IstioActions/IstioActionsNamespaceDropdown';
import { KialiAppState } from '../../store/Store';
import { activeNamespacesSelector } from '../../store/Selectors';
import { connect } from 'react-redux';
import DefaultSecondaryMasthead from '../../components/DefaultSecondaryMasthead/DefaultSecondaryMasthead';

interface IstioConfigListPageState extends FilterComponent.State<IstioConfigItem> {}
interface IstioConfigListPageProps extends FilterComponent.Props<IstioConfigItem> {
  activeNamespaces: Namespace[];
}

class IstioConfigListPageComponent extends FilterComponent.Component<
  IstioConfigListPageProps,
  IstioConfigListPageState,
  IstioConfigItem
> {
  private promises = new PromisesRegistry();

  constructor(props: IstioConfigListPageProps) {
    super(props);
    const prevCurrentSortField = FilterHelper.currentSortField(IstioConfigListFilters.sortFields);
    const prevIsSortAscending = FilterHelper.isCurrentSortAscending();

    this.state = {
      listItems: [],
      currentSortField: prevCurrentSortField,
      isSortAscending: prevIsSortAscending
    };
  }

  componentDidMount() {
    this.updateListItems();
  }

  componentDidUpdate(prevProps: IstioConfigListPageProps, _prevState: IstioConfigListPageState, _snapshot: any) {
    const prevCurrentSortField = FilterHelper.currentSortField(IstioConfigListFilters.sortFields);
    const prevIsSortAscending = FilterHelper.isCurrentSortAscending();
    if (
      !namespaceEquals(this.props.activeNamespaces, prevProps.activeNamespaces) ||
      this.state.currentSortField !== prevCurrentSortField ||
      this.state.isSortAscending !== prevIsSortAscending
    ) {
      this.setState({
        currentSortField: prevCurrentSortField,
        isSortAscending: prevIsSortAscending
      });

      this.updateListItems();
    }
  }

  componentWillUnmount() {
    this.promises.cancelAll();
  }

  sortItemList(apps: IstioConfigItem[], sortField: SortField<IstioConfigItem>, isAscending: boolean) {
    return IstioConfigListFilters.sortIstioItems(apps, sortField, isAscending);
  }

  updateListItems() {
    this.promises.cancelAll();

    const activeFilters: ActiveFiltersInfo = FilterSelected.getSelected();
    const namespacesSelected = this.props.activeNamespaces!.map(item => item.name);
    const istioTypeFilters = getFilterSelectedValues(IstioConfigListFilters.istioTypeFilter, activeFilters).map(
      value => dicIstioType[value]
    );
    const istioNameFilters = getFilterSelectedValues(IstioConfigListFilters.istioNameFilter, activeFilters);
    const configValidationFilters = getFilterSelectedValues(
      IstioConfigListFilters.configValidationFilter,
      activeFilters
    );

    if (namespacesSelected.length !== 0) {
      this.fetchConfigs(namespacesSelected, istioTypeFilters, istioNameFilters, configValidationFilters);
    } else {
      this.setState({ listItems: [] });
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
        items
          .map(item => item.validation)
          .filter((validation): validation is ObjectValidation => validation !== undefined)
      )
      .then(validations => showInMessageCenter(validations));

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
      .registerAll(
        'configs',
        namespaces.map(ns => API.getIstioConfig(ns, typeFilters, true, '', ''))
      )
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
      <>
        <div style={{ backgroundColor: '#fff' }}>
          <DefaultSecondaryMasthead
            rightToolbar={<RefreshButtonContainer key={'Refresh'} handleRefresh={this.updateListItems} />}
            actionsToolbar={<IstioActionsNamespaceDropdown />}
          />
        </div>
        <RenderContent>
          <VirtualList rows={this.state.listItems}>
            <StatefulFilters
              initialFilters={IstioConfigListFilters.availableFilters}
              onFilterChange={this.onFilterChange}
            />
          </VirtualList>
        </RenderContent>
      </>
    );
  }
}

const mapStateToProps = (state: KialiAppState) => ({
  activeNamespaces: activeNamespacesSelector(state)
});

const IstioConfigListPage = connect(mapStateToProps, null)(IstioConfigListPageComponent);
export default IstioConfigListPage;
