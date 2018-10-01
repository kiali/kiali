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
import { authentication } from '../../utils/Authentication';
import { NamespaceValidations } from '../../types/IstioObjects';
import { ConfigIndicator } from '../../components/ConfigValidation/ConfigIndicator';
import { CancelablePromise, makeCancelablePromise, removeDuplicatesArray } from '../../utils/Common';
import { ListPage } from '../../components/ListPage/ListPage';
import { IstioConfigListFilters } from './FiltersAndSorts';
import { ListComponent } from '../../components/ListPage/ListComponent';
import { SortField } from '../../types/SortFilters';

interface IstioConfigListComponentState extends ListComponent.State<IstioConfigItem> {}
interface IstioConfigListComponentProps extends ListComponent.Props<IstioConfigItem> {}

class IstioConfigListComponent extends ListComponent.Component<
  IstioConfigListComponentProps,
  IstioConfigListComponentState,
  IstioConfigItem
> {
  private nsPromise?: CancelablePromise<API.Response<Namespace[]>>;
  private configsPromise?: CancelablePromise<IstioConfigItem[] | NamespaceValidations>;

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
    prevState: IstioConfigListComponentState,
    snapshot: any
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
    this.cancelAsyncs();
  }

  paramsAreSynced(prevProps: IstioConfigListComponentProps) {
    return (
      prevProps.pagination.page === this.props.pagination.page &&
      prevProps.pagination.perPage === this.props.pagination.perPage &&
      prevProps.isSortAscending === this.props.isSortAscending &&
      prevProps.currentSortField.title === this.props.currentSortField.title
    );
  }

  sortItemList(apps: IstioConfigItem[], sortField: SortField<IstioConfigItem>, isAscending: boolean) {
    return IstioConfigListFilters.sortIstioItems(apps, sortField, isAscending);
  }

  updateListItems(resetPagination?: boolean) {
    this.cancelAsyncs();

    const activeFilters: ActiveFilter[] = FilterSelected.getSelected();
    let namespacesSelected: string[] = activeFilters
      .filter(activeFilter => activeFilter.category === 'Namespace')
      .map(activeFilter => activeFilter.value);
    let istioTypeFilters: string[] = activeFilters
      .filter(activeFilter => activeFilter.category === 'Istio Type')
      .map(activeFilter => dicIstioType[activeFilter.value]);
    let istioNameFilters: string[] = activeFilters
      .filter(activeFilter => activeFilter.category === 'Istio Name')
      .map(activeFilter => activeFilter.value);
    let configValidationFilters: string[] = activeFilters
      .filter(activeFilter => activeFilter.category === 'Config')
      .map(activeFilter => activeFilter.value);

    /** Remove duplicates  */
    namespacesSelected = removeDuplicatesArray(namespacesSelected);
    istioTypeFilters = removeDuplicatesArray(istioTypeFilters);
    istioNameFilters = removeDuplicatesArray(istioNameFilters);
    configValidationFilters = removeDuplicatesArray(configValidationFilters);

    if (namespacesSelected.length === 0) {
      this.nsPromise = makeCancelablePromise(API.getNamespaces(authentication()));
      this.nsPromise.promise
        .then(namespacesResponse => {
          const namespaces: Namespace[] = namespacesResponse['data'];
          this.fetchIstioConfig(
            namespaces.map(namespace => namespace.name),
            istioTypeFilters,
            istioNameFilters,
            configValidationFilters,
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
      this.fetchIstioConfig(
        namespacesSelected,
        istioTypeFilters,
        istioNameFilters,
        configValidationFilters,
        resetPagination
      );
    }
  }

  updateValidation(istioItems: IstioConfigItem[], namespaceValidation: NamespaceValidations): IstioConfigItem[] {
    istioItems.forEach(istioItem => {
      if (
        namespaceValidation[istioItem.namespace] &&
        namespaceValidation[istioItem.namespace][istioItem.type] &&
        namespaceValidation[istioItem.namespace][istioItem.type][istioItem.name]
      ) {
        istioItem.validation = namespaceValidation[istioItem.namespace][istioItem.type][istioItem.name];
      }
    });
    return istioItems;
  }

  fetchIstioConfig(
    namespaces: string[],
    istioTypeFilters: string[],
    istioNameFilters: string[],
    configValidationFilters: string[],
    resetPagination?: boolean
  ) {
    // Retrieve the istio config list/items
    const istioConfigPromises = namespaces.map(namespace =>
      API.getIstioConfig(authentication(), namespace, istioTypeFilters)
    );

    // There is the advantage that there is no need to wait until the istio config list is fetched in order
    // to fetch validations. So, lets retrieve validations to save time.
    const validationPromises = Promise.all(
      namespaces.map(namespace => API.getNamespaceValidations(authentication(), namespace))
    ).then(responses => {
      let namespaceValidations: NamespaceValidations = {};
      responses.forEach(response =>
        Object.keys(response.data).forEach(namespace => (namespaceValidations[namespace] = response.data[namespace]))
      );
      return namespaceValidations;
    });

    // Once all istio configs are retrieved, apply filters and map the received data into a flattened list.
    // "fetchPromise" is the one that will update the state to show the list.
    let fetchPromise = Promise.all(istioConfigPromises).then(responses => {
      let istioItems: IstioConfigItem[] = [];
      responses.forEach(response => {
        istioItems = istioItems.concat(toIstioItems(filterByName(response.data, istioNameFilters)));
      });

      return istioItems;
    });

    if (configValidationFilters.length > 0 || this.state.currentSortField.id === 'configvalidation') {
      // If user *is* filtering and/or sorting using "validations", we must wait until the validations are fetched in order
      // to update/sort the view. This way, we avoid a flickering list and/or ending up with a wrong sorting.
      // So, unify <validationPromises> and <fetchPromise>.
      fetchPromise = fetchPromise.then(items => {
        return validationPromises.then(namespaceValidations => {
          return filterByConfigValidation(this.updateValidation(items, namespaceValidations), configValidationFilters);
        });
      });
    }

    // Update the view when data is fetched --- Make <fetchPromise> cancelable to avoid updating
    // the state if the component umounts before data retrieval finishes.
    this.configsPromise = makeCancelablePromise(fetchPromise);
    this.configsPromise.promise
      .then(istioItems => {
        const currentPage = resetPagination ? 1 : this.state.pagination.page;

        IstioConfigListFilters.sortIstioItems(
          istioItems as IstioConfigItem[],
          this.state.currentSortField,
          this.state.isSortAscending
        ).then(sorted => {
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
        });
      })
      .catch(istioError => {
        if (!istioError.isCanceled) {
          this.handleAxiosError('Could not fetch Istio objects list.', istioError);
        }
      });

    if (configValidationFilters.length === 0 && this.state.currentSortField.id !== 'configvalidation') {
      // If user *is not* filtering nor sorting using "validations", we can show the list as soon as istio configs
      // are retrieved and update the view at a later time once the validations are fetched.
      this.configsPromise.promise
        .then(istioItems => {
          this.configsPromise = makeCancelablePromise(validationPromises);
          this.configsPromise.promise
            .then(namespaceValidations => {
              this.updateValidation(istioItems as IstioConfigItem[], namespaceValidations as NamespaceValidations);
              this.forceUpdate();
            })
            .catch(istioError => {
              if (!istioError.isCanceled) {
                this.handleAxiosError('Could not fetch Istio objects list.', istioError);
              }
            });
        })
        .catch(() => undefined);
    }
  }

  renderIstioItem(istioItem: IstioConfigItem, index: number) {
    let to = '/namespaces/' + istioItem.namespace + '/istio';
    let name = istioItem.name;
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
    } else if (istioItem.type === 'quotaspec') {
      iconName = 'process-automation';
      iconType = 'pf';
      type = 'QuotaSpec';
    } else if (istioItem.type === 'quotaspecbinding') {
      iconName = 'integration';
      iconType = 'pf';
      type = 'QuotaSpecBinding';
    }
    to = to + '/' + dicIstioType[type] + '/' + name;

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
    let istioList: any = [];
    let pageStart = (this.state.pagination.page - 1) * this.state.pagination.perPage;
    let pageEnd = pageStart + this.state.pagination.perPage;
    pageEnd = pageEnd < this.state.listItems.length ? pageEnd : this.state.listItems.length;

    for (let i = pageStart; i < pageEnd; i++) {
      istioList.push(this.renderIstioItem(this.state.listItems[i], i));
    }

    let ruleListComponent;
    ruleListComponent = (
      <>
        <StatefulFilters
          initialFilters={IstioConfigListFilters.availableFilters}
          pageHooks={this.props.pageHooks}
          onFilterChange={this.onFilterChange}
        >
          <Sort>
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
          <ToolbarRightContent>
            <Button onClick={this.updateListItems}>
              <Icon name="refresh" />
            </Button>
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

  private cancelAsyncs = () => {
    if (this.nsPromise) {
      this.nsPromise.cancel();
      this.nsPromise = undefined;
    }
    if (this.configsPromise) {
      this.configsPromise.cancel();
      this.configsPromise = undefined;
    }
  };
}

export default IstioConfigListComponent;
