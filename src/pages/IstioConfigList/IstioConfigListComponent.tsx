import * as React from 'react';
import { connect } from 'react-redux';
import { ListView, ListViewIcon, ListViewItem, Paginator, Sort, ToolbarRightContent } from 'patternfly-react';
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
import { Link } from 'react-router-dom';
import { PfColors } from '../../components/Pf/PfColors';
import { ConfigIndicator } from '../../components/ConfigValidation/ConfigIndicator';
import { PromisesRegistry } from '../../utils/CancelablePromises';
import * as ListPagesHelper from '../../components/ListPage/ListPagesHelper';
import * as IstioConfigListFilters from './FiltersAndSorts';
import * as ListComponent from '../../components/ListPage/ListComponent';
import { SortField } from '../../types/SortFilters';
import { getFilterSelectedValues } from '../../components/Filters/CommonFilters';
import { AlignRightStyle, ThinStyle } from '../../components/Filters/FilterStyles';
import { arrayEquals } from '../../utils/Common';
import { KialiAppState } from '../../store/Store';
import { activeNamespacesSelector } from '../../store/Selectors';
import RefreshButtonContainer from '../../components/Refresh/RefreshButton';

interface IstioConfigListComponentState extends ListComponent.State<IstioConfigItem> {}
interface IstioConfigListComponentProps extends ListComponent.Props<IstioConfigItem> {
  activeNamespaces: Namespace[];
}

class IstioConfigListComponent extends ListComponent.Component<
  IstioConfigListComponentProps,
  IstioConfigListComponentState,
  IstioConfigItem
> {
  private promises = new PromisesRegistry();

  constructor(props: IstioConfigListComponentProps) {
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

  componentDidUpdate(
    prevProps: IstioConfigListComponentProps,
    _prevState: IstioConfigListComponentState,
    _snapshot: any
  ) {
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

  paramsAreSynced(prevProps: IstioConfigListComponentProps) {
    const activeNamespacesCompare = arrayEquals(
      prevProps.activeNamespaces,
      this.props.activeNamespaces,
      (n1, n2) => n1.name === n2.name
    );
    return (
      prevProps.pagination.page === this.props.pagination.page &&
      prevProps.pagination.perPage === this.props.pagination.perPage &&
      activeNamespacesCompare &&
      prevProps.isSortAscending === this.props.isSortAscending &&
      prevProps.currentSortField.title === this.props.currentSortField.title
    );
  }

  sortItemList(apps: IstioConfigItem[], sortField: SortField<IstioConfigItem>, isAscending: boolean) {
    return IstioConfigListFilters.sortIstioItems(apps, sortField, isAscending);
  }

  updateListItems(resetPagination?: boolean) {
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
            configValidationFilters,
            resetPagination
          );
        })
        .catch(namespacesError => {
          if (!namespacesError.isCanceled) {
            this.handleAxiosError('Could not fetch namespace list', namespacesError);
          }
        });
    } else {
      this.fetchConfigs(
        namespacesSelected,
        istioTypeFilters,
        istioNameFilters,
        configValidationFilters,
        resetPagination
      );
    }
  }

  fetchConfigs(
    namespaces: string[],
    istioTypeFilters: string[],
    istioNameFilters: string[],
    configValidationFilters: string[],
    resetPagination?: boolean
  ) {
    const configsPromises = this.fetchIstioConfigs(namespaces, istioTypeFilters, istioNameFilters);

    configsPromises
      .then(items =>
        IstioConfigListFilters.sortIstioItems(items, this.state.currentSortField, this.state.isSortAscending)
      )
      .then(configItems => filterByConfigValidation(configItems, configValidationFilters))
      .then(sorted => {
        // Update the view when data is fetched
        const currentPage = resetPagination ? 1 : this.state.pagination.page;
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

  renderIstioItem(istioItem: IstioConfigItem, index: number) {
    let to = '/namespaces/' + istioItem.namespace + '/istio';
    const name = istioItem.name;
    let iconName = '';
    let iconType = '';
    let type = 'No type found';
    if (istioItem.type === 'gateway') {
      iconName = 'route';
      iconType = 'pf';
      type = 'Gateway';
    } else if (istioItem.type === 'virtualservice') {
      iconName = 'code-fork';
      iconType = 'fa';
      type = 'VirtualService';
    } else if (istioItem.type === 'destinationrule') {
      iconName = 'network';
      iconType = 'pf';
      type = 'DestinationRule';
    } else if (istioItem.type === 'serviceentry') {
      iconName = 'services';
      iconType = 'pf';
      type = 'ServiceEntry';
    } else if (istioItem.type === 'rule') {
      iconName = 'migration';
      iconType = 'pf';
      type = 'Rule';
    } else if (istioItem.type === 'adapter') {
      iconName = 'migration';
      iconType = 'pf';
      type = 'Adapter: ' + istioItem.adapter!.adapter;
    } else if (istioItem.type === 'template') {
      iconName = 'migration';
      iconType = 'pf';
      type = 'Template: ' + istioItem.template!.template;
    } else if (istioItem.type === 'quotaspec') {
      iconName = 'process-automation';
      iconType = 'pf';
      type = 'QuotaSpec';
    } else if (istioItem.type === 'quotaspecbinding') {
      iconName = 'integration';
      iconType = 'pf';
      type = 'QuotaSpecBinding';
    } else if (istioItem.type === 'policy') {
      iconName = 'locked';
      iconType = 'pf';
      type = 'Policy';
    } else if (istioItem.type === 'meshpolicy') {
      iconName = 'locked';
      iconType = 'pf';
      type = 'MeshPolicy';
    } else if (istioItem.type === 'clusterrbacconfig') {
      iconName = 'locked';
      iconType = 'pf';
      type = 'ClusterRbacConfig';
    } else if (istioItem.type === 'rbacconfig') {
      iconName = 'locked';
      iconType = 'pf';
      type = 'RbacConfig';
    } else if (istioItem.type === 'sidecar') {
      iconName = 'integration';
      iconType = 'pf';
      type = 'Sidecar';
    } else if (istioItem.type === 'servicerole') {
      iconName = 'locked';
      iconType = 'pf';
      type = 'ServiceRole';
    } else if (istioItem.type === 'servicerolebinding') {
      iconName = 'locked';
      iconType = 'pf';
      type = 'ServiceRoleBinding';
    } else {
      console.warn('Istio Object ' + istioItem.type + ' not supported');
    }

    if (type === 'No type found') {
      return undefined;
    }

    // Adapters and Templates need to pass subtype
    if (istioItem.type === 'adapter' || istioItem.type === 'template') {
      // Build a /adapters/<adapter_type_plural>/<adapter_name> or
      //         /templates/<template_type_plural>/<template_name>
      const istioType = istioItem.type + 's';
      const subtype = istioItem.type === 'adapter' ? istioItem.adapter!.adapters : istioItem.template!.templates;
      to = to + '/' + istioType + '/' + subtype + '/' + name;
    } else {
      to = to + '/' + dicIstioType[type] + '/' + name;
    }

    const itemDescription = (
      <table style={{ width: '30em', tableLayout: 'fixed' }}>
        <tbody>
          <tr>
            <td>{type}</td>
            {istioItem.validation ? (
              <td>
                <strong>Config: </strong>{' '}
                <ConfigIndicator id={index + '-config-validation'} validations={[istioItem.validation]} size="medium" />
              </td>
            ) : (
              undefined
            )}
          </tr>
        </tbody>
      </table>
    );

    return (
      <Link
        key={'istioItemItem_' + index + '_' + istioItem.namespace + '_' + name}
        to={to}
        style={{ color: PfColors.Black }}
      >
        <ListViewItem
          leftContent={<ListViewIcon type={iconType} name={iconName} />}
          heading={
            <span>
              {name}
              <small>{istioItem.namespace}</small>
            </span>
          }
          description={itemDescription}
        />
      </Link>
    );
  }

  render() {
    const istioList: any = [];
    const pageStart = (this.state.pagination.page - 1) * this.state.pagination.perPage;
    let pageEnd = pageStart + this.state.pagination.perPage;
    pageEnd = pageEnd < this.state.listItems.length ? pageEnd : this.state.listItems.length;

    for (let i = pageStart; i < pageEnd; i++) {
      istioList.push(this.renderIstioItem(this.state.listItems[i], i));
    }

    let ruleListComponent;
    ruleListComponent = (
      <>
        <StatefulFilters initialFilters={IstioConfigListFilters.availableFilters} onFilterChange={this.onFilterChange}>
          <Sort style={{ ...ThinStyle }}>
            <Sort.TypeSelector
              sortTypes={IstioConfigListFilters.sortFields}
              currentSortType={this.state.currentSortField}
              onSortTypeSelected={this.updateSortField}
            />
            <Sort.DirectionSelector
              isNumeric={false}
              isAscending={this.state.isSortAscending}
              onClick={this.updateSortDirection}
            />
          </Sort>
          <ToolbarRightContent style={{ ...AlignRightStyle }}>
            <RefreshButtonContainer handleRefresh={this.updateListItems} />
          </ToolbarRightContent>
        </StatefulFilters>
        <ListView>{istioList}</ListView>
        <Paginator
          viewType="list"
          pagination={this.state.pagination}
          itemCount={this.state.listItems.length}
          onPageSet={this.pageSet}
          onPerPageSelect={this.perPageSelect}
        />
      </>
    );
    return <div>{ruleListComponent}</div>;
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
