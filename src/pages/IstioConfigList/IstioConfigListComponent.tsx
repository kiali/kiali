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
import { removeDuplicatesArray } from '../../utils/Common';
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
      API.getNamespaces(authentication())
        .then(namespacesResponse => {
          const namespaces: Namespace[] = namespacesResponse['data'];
          this.fetchIstioConfig(
            namespaces.map(namespace => namespace.name),
            istioTypeFilters,
            istioNameFilters,
            configValidationFilters,
            resetPagination
          );
        })
        .catch(namespacesError => this.handleAxiosError('Could not fetch namespace list.', namespacesError));
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
    const istioConfigPromises = namespaces.map(namespace =>
      API.getIstioConfig(authentication(), namespace, istioTypeFilters)
    );

    const validationPromises = namespaces.map(namespace => API.getNamespaceValidations(authentication(), namespace));

    Promise.all(istioConfigPromises)
      .then(responses => {
        const currentPage = resetPagination ? 1 : this.state.pagination.page;

        let istioItems: IstioConfigItem[] = [];
        responses.forEach(response => {
          istioItems = istioItems.concat(toIstioItems(filterByName(response.data, istioNameFilters)));
        });

        IstioConfigListFilters.sortIstioItems(istioItems, this.state.currentSortField, this.state.isSortAscending).then(
          sortedItems => {
            this.setState(prevState => {
              return {
                listItems: sortedItems,
                pagination: {
                  page: currentPage,
                  perPage: prevState.pagination.perPage,
                  perPageOptions: ListPage.perPageOptions
                }
              };
            });
          }
        );

        return Promise.all(validationPromises);
      })
      .then(responses => {
        let namespaceValidations: NamespaceValidations = {};
        responses.forEach(response =>
          Object.keys(response.data).forEach(namespace => (namespaceValidations[namespace] = response.data[namespace]))
        );
        this.setState(prevState => {
          return {
            listItems: filterByConfigValidation(
              this.updateValidation(prevState.listItems, namespaceValidations),
              configValidationFilters
            )
          };
        });
      })
      .catch(istioError => this.handleAxiosError('Could not fetch Istio objects list.', istioError));
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
}

export default IstioConfigListComponent;
