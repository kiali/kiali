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
import { ActiveFiltersInfo, ActiveTogglesInfo } from '../../types/Filters';
import { FilterSelected, StatefulFilters, Toggles } from '../../components/Filters/StatefulFilters';
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
import { isMultiCluster, serverConfig } from '../../config';
import { HomeClusterName } from '../../types/Common';

interface IstioConfigListPageState extends FilterComponent.State<IstioConfigItem> {}
interface IstioConfigListPageProps extends FilterComponent.Props<IstioConfigItem> {
  activeNamespaces: Namespace[];
  istioAPIEnabled: boolean;
}

class IstioConfigListPageComponent extends FilterComponent.Component<
  IstioConfigListPageProps,
  IstioConfigListPageState,
  IstioConfigItem
> {
  private promises = new PromisesRegistry();
  private initialToggles = IstioConfigListFilters.getAvailableToggles();

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
    const activeToggles: ActiveTogglesInfo = Toggles.getToggles();
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
      this.setState({ listItems: [] });
      if (isMultiCluster()) {
        for (let cluster in serverConfig.clusters) {
          this.fetchConfigs(
            cluster,
            namespacesSelected,
            istioTypeFilters,
            istioNameFilters,
            configValidationFilters,
            activeToggles
          );
        }
      } else {
        this.fetchConfigs(
          HomeClusterName,
          namespacesSelected,
          istioTypeFilters,
          istioNameFilters,
          configValidationFilters,
          activeToggles
        );
      }
    } else {
      this.setState({ listItems: [] });
    }
  }

  fetchConfigs(
    cluster: string,
    namespaces: string[],
    istioTypeFilters: string[],
    istioNameFilters: string[],
    configValidationFilters: string[],
    toggles: ActiveTogglesInfo
  ) {
    const configsPromises = this.fetchIstioConfigs(cluster, namespaces, istioTypeFilters, istioNameFilters, toggles);

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
          listItems: this.state.listItems.concat(sorted)
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
  fetchIstioConfigs(
    cluster: string,
    namespaces: string[],
    typeFilters: string[],
    istioNameFilters: string[],
    toggles: ActiveTogglesInfo
  ) {
    let validate = false;
    if (this.props.istioAPIEnabled) {
      validate = !!toggles.get('configuration');
    }
    // Request all configs from all namespaces, as in backend all configs are always loaded from registry
    return this.promises
      .register('configs' + cluster, API.getAllIstioConfigs(namespaces, typeFilters, validate, '', '', cluster))
      .then(response => {
        let istioItems: IstioConfigItem[] = [];
        // filter by selected namespaces
        namespaces.forEach(ns => {
          istioItems = istioItems.concat(toIstioItems(filterByName(response.data[ns], istioNameFilters), cluster));
        });
        return istioItems;
      });
  }

  render() {
    const hiddenColumns = isMultiCluster() ? ([] as string[]) : ['cluster'];
    if (this.props.istioAPIEnabled) {
      Toggles.getToggles().forEach((v, k) => {
        if (!v) {
          hiddenColumns.push(k);
        }
      });
    } else {
      hiddenColumns.push('configuration');
    }

    return (
      <>
        <div style={{ backgroundColor: '#fff' }}>
          <DefaultSecondaryMasthead
            rightToolbar={<RefreshButtonContainer key={'Refresh'} handleRefresh={this.updateListItems} />}
            actionsToolbar={<IstioActionsNamespaceDropdown />}
          />
        </div>
        <RenderContent>
          <VirtualList rows={this.state.listItems} hiddenColumns={hiddenColumns}>
            <StatefulFilters
              initialFilters={IstioConfigListFilters.availableFilters}
              initialToggles={this.props.istioAPIEnabled ? this.initialToggles : undefined}
              onFilterChange={this.onFilterChange}
              onToggleChange={this.props.istioAPIEnabled ? this.onFilterChange : undefined}
            />
          </VirtualList>
        </RenderContent>
      </>
    );
  }
}

const mapStateToProps = (state: KialiAppState) => ({
  activeNamespaces: activeNamespacesSelector(state),
  istioAPIEnabled: state.statusState.istioEnvironment.istioAPIEnabled
});

const IstioConfigListPage = connect(mapStateToProps, null)(IstioConfigListPageComponent);
export default IstioConfigListPage;
