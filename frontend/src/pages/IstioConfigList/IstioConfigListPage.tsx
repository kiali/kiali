import * as React from 'react';
import * as FilterHelper from '../../components/FilterList/FilterHelper';
import { RenderContent } from '../../components/Nav/Page';
import * as IstioConfigListFilters from './FiltersAndSorts';
import * as FilterComponent from '../../components/FilterList/FilterComponent';
import type { IstioConfigItem } from '../../types/IstioConfigList';
import {
  filterByConfigValidation,
  filterByName,
  filterByNamespaces,
  gvkType,
  toIstioItems
} from '../../types/IstioConfigList';
import type { Namespace } from '../../types/Namespace';
import { MessageType } from '../../types/NotificationCenter';
import { PromisesRegistry } from '../../utils/CancelablePromises';
import { namespaceEquals } from '../../utils/Common';
import type { SortField } from '../../types/SortFilters';
import type { ActiveFiltersInfo, ActiveTogglesInfo } from '../../types/Filters';
import { FilterSelected, StatefulFilters, Toggles } from '../../components/Filters/StatefulFilters';
import { getFilterSelectedValues } from '../../components/Filters/CommonFilters';
import * as API from '../../services/Api';
import { addError } from '../../utils/AlertUtils';
import type { ObjectValidation } from '../../types/IstioObjects';
import { showInNotificationCenter } from '../../utils/IstioValidationUtils';
import { VirtualList } from '../../components/VirtualList/VirtualList';
import { RefreshButton } from '../../components/Refresh/RefreshButton';
import { IstioActionsNamespaceDropdown } from '../../components/IstioActions/IstioActionsNamespaceDropdown';
import type { KialiAppState } from '../../store/Store';
import { activeNamespacesSelector } from '../../store/Selectors';
import type { DispatchProp } from 'react-redux';
import { connect } from 'react-redux';
import { DefaultSecondaryMasthead } from '../../components/DefaultSecondaryMasthead/DefaultSecondaryMasthead';
import { isMultiCluster, serverConfig } from '../../config';
import { getGVKTypeString } from '../../utils/IstioConfigUtils';

interface ReduxProps {
  activeNamespaces: Namespace[];
}

type IstioConfigListPageProps = ReduxProps & DispatchProp;

type IstioConfigListPageState = FilterComponent.State<IstioConfigItem>;

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

  componentDidMount(): void {
    this.updateListItems();
  }

  componentDidUpdate(prevProps: IstioConfigListPageProps, _prevState: IstioConfigListPageState, _snapshot: any): void {
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

  componentWillUnmount(): void {
    this.promises.cancelAll();
  }

  onSort = (): void => {
    // force list update on sorting
    this.setState({});
  };

  sortItemList(
    apps: IstioConfigItem[],
    sortField: SortField<IstioConfigItem>,
    isAscending: boolean
  ): IstioConfigItem[] {
    return IstioConfigListFilters.sortIstioItems(apps, sortField, isAscending);
  }

  updateListItems(): void {
    this.promises.cancelAll();

    const activeFilters: ActiveFiltersInfo = FilterSelected.getSelected();
    const activeToggles: ActiveTogglesInfo = Toggles.getToggles();
    const namespacesSelected = this.props.activeNamespaces!.map(item => item.name);

    const istioTypeFilters = getFilterSelectedValues(IstioConfigListFilters.istioTypeFilter, activeFilters).map(value =>
      getGVKTypeString(gvkType[value])
    );

    const istioNameFilters = getFilterSelectedValues(IstioConfigListFilters.istioNameFilter, activeFilters);

    const configValidationFilters = getFilterSelectedValues(
      IstioConfigListFilters.configValidationFilter,
      activeFilters
    );

    if (namespacesSelected.length !== 0) {
      this.setState({ listItems: [] });

      if (isMultiCluster) {
        for (const cluster in serverConfig.clusters) {
          this.fetchConfigs(
            namespacesSelected,
            istioTypeFilters,
            istioNameFilters,
            configValidationFilters,
            activeToggles,
            cluster
          );
        }
      } else {
        this.fetchConfigs(
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
    namespaces: string[],
    istioTypeFilters: string[],
    istioNameFilters: string[],
    configValidationFilters: string[],
    toggles: ActiveTogglesInfo,
    cluster?: string
  ): void {
    const configsPromises = this.fetchIstioConfigs(namespaces, istioTypeFilters, istioNameFilters, toggles, cluster);

    configsPromises
      .then(items =>
        items
          .map(item => item.validation)
          .filter((validation): validation is ObjectValidation => validation !== undefined)
      )
      .then(validations => showInNotificationCenter(validations));

    configsPromises
      .then(configItems => filterByConfigValidation(configItems, configValidationFilters))
      .then(sorted => {
        // Update the view when data is fetched. Functional update: per-cluster fetches
        // resolve independently and React 18 batches their setStates, so reading
        // this.state here can drop a cluster's already-added items.
        this.setState(prevState => ({
          listItems: IstioConfigListFilters.sortIstioItems(
            prevState.listItems.concat(sorted),
            prevState.currentSortField,
            prevState.isSortAscending
          )
        }));
      })
      .catch(istioError => {
        if (!istioError.isCanceled) {
          // One cluster's failure (e.g. a partially-revoked namespace) degrades the
          // list to that cluster's objects, not the page.
          const scope = cluster ? ` for cluster [${cluster}]` : '';
          addError(`Could not fetch Istio objects list${scope}`, istioError, true, MessageType.WARNING);
        }
      });
  }

  // Fetch the Istio configs, apply filters and map them into flattened list items
  async fetchIstioConfigs(
    namespaces: string[],
    typeFilters: string[],
    istioNameFilters: string[],
    toggles: ActiveTogglesInfo,
    cluster?: string
  ): Promise<IstioConfigItem[]> {
    // Request validations when the Configuration Validation toggle is on.
    const validate = !!toggles.get('configuration');
    return this.promises
      .register(`configs${cluster}`, API.getAllIstioConfigs(typeFilters, validate, '', '', cluster))
      .then(response => {
        return toIstioItems(filterByNamespaces(filterByName(response.data, istioNameFilters), namespaces), cluster);
      });
  }

  render(): React.ReactNode {
    const hiddenColumns = isMultiCluster ? ([] as string[]) : ['cluster'];

    // Hide columns for toggles that are off (same logic whether or not Istio API is enabled).
    Toggles.getToggles().forEach((v, k) => {
      if (!v) {
        hiddenColumns.push(k);
      }
    });

    return (
      <>
        <DefaultSecondaryMasthead
          rightToolbar={<RefreshButton key="Refresh" handleRefresh={this.updateListItems} />}
          actionsToolbar={<IstioActionsNamespaceDropdown />}
        />

        <RenderContent>
          <VirtualList rows={this.state.listItems} hiddenColumns={hiddenColumns} sort={this.onSort} type="istio">
            <StatefulFilters
              initialFilters={IstioConfigListFilters.availableFilters}
              initialToggles={this.initialToggles}
              onFilterChange={this.onFilterChange}
              onToggleChange={this.onFilterChange}
            />
          </VirtualList>
        </RenderContent>
      </>
    );
  }
}

const mapStateToProps = (state: KialiAppState): ReduxProps => ({
  activeNamespaces: activeNamespacesSelector(state)
});

export const IstioConfigListPage = connect(mapStateToProps)(IstioConfigListPageComponent);
