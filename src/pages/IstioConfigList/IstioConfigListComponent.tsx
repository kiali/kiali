import * as React from 'react';
import { ListView, ListViewItem, ListViewIcon, Sort } from 'patternfly-react';
import { AxiosError } from 'axios';
import { NamespaceFilter, NamespaceFilterSelected } from '../../components/NamespaceFilter/NamespaceFilter';
import { Paginator } from 'patternfly-react';
import { ActiveFilter, FilterType } from '../../types/NamespaceFilter';
import * as API from '../../services/Api';
import Namespace from '../../types/Namespace';
import { Pagination } from '../../types/Pagination';
import {
  dicIstioType,
  filterByConfigValidation,
  filterByName,
  IstioConfigItem,
  SortField,
  sortIstioItems,
  toIstioItems
} from '../../types/IstioConfigListComponent';
import PropTypes from 'prop-types';
import { Link } from 'react-router-dom';
import { PfColors } from '../../components/Pf/PfColors';
import { authentication } from '../../utils/Authentication';
import { NamespaceValidations } from '../../types/ServiceInfo';
import { ConfigIndicator } from '../../components/ConfigValidation/ConfigIndicator';

const sortFields: SortField[] = [
  {
    id: 'namespace',
    title: 'Namespace',
    isNumeric: false
  },
  {
    id: 'istiotype',
    title: 'Istio Type',
    isNumeric: false
  },
  {
    id: 'istioname',
    title: 'Istio Name',
    isNumeric: false
  },
  {
    id: 'configvalidation',
    title: 'Config',
    isNumeric: false
  }
];

const istioNameFilter: FilterType = {
  id: 'istioname',
  title: 'Istio Name',
  placeholder: 'Filter by Istio Name',
  filterType: 'text',
  filterValues: []
};

const istioTypeFilter: FilterType = {
  id: 'istiotype',
  title: 'Istio Type',
  placeholder: 'Filter by Istio Type',
  filterType: 'select',
  filterValues: [
    {
      id: 'Gateway',
      title: 'Gateway'
    },
    {
      id: 'RouteRule',
      title: 'RouteRule'
    },
    {
      id: 'DestinationPolicy',
      title: 'DestinationPolicy'
    },
    {
      id: 'VirtualService',
      title: 'VirtualService'
    },
    {
      id: 'DestinationRule',
      title: 'DestinationRule'
    },
    {
      id: 'ServiceEntry',
      title: 'ServiceEntry'
    },
    {
      id: 'Rule',
      title: 'Rule'
    }
  ]
};

const configValidationFilter: FilterType = {
  id: 'configvalidation',
  title: 'Config',
  placeholder: 'Filter by Config Validation',
  filterType: 'select',
  filterValues: [
    {
      id: 'valid',
      title: 'Valid'
    },
    {
      id: 'notvalid',
      title: 'Not Valid'
    },
    {
      id: 'notvalidated',
      title: 'Not Validated'
    }
  ]
};

type IstioConfigListComponentState = {
  loading: boolean;
  istioItems: IstioConfigItem[];
  pagination: Pagination;
  currentSortField: SortField;
  isSortAscending: boolean;
};

type IstioConfigListComponentProps = {
  onError: PropTypes.func;
};

const perPageOptions: number[] = [5, 10, 15];

class IstioConfigListComponent extends React.Component<IstioConfigListComponentProps, IstioConfigListComponentState> {
  constructor(props: IstioConfigListComponentProps) {
    super(props);
    this.filterChange = this.filterChange.bind(this);
    this.handleError = this.handleError.bind(this);
    this.pageSet = this.pageSet.bind(this);
    this.pageSelect = this.pageSelect.bind(this);
    this.updateSortField = this.updateSortField.bind(this);
    this.updateSortDirection = this.updateSortDirection.bind(this);
    this.state = {
      loading: true,
      istioItems: [],
      pagination: { page: 1, perPage: 10, perPageOptions: perPageOptions },
      currentSortField: sortFields[0],
      isSortAscending: true
    };
  }

  componentDidMount() {
    this.setState({ loading: true });
    this.updateIstioConfig();
  }

  filterChange() {
    this.setState({ loading: true });
    this.updateIstioConfig();
  }

  handleError(error: string) {
    this.props.onError(error);
    this.setState({ loading: false });
  }

  handleAxiosError(message: string, error: AxiosError) {
    const errMsg = API.getErrorMsg(message, error);
    console.error(errMsg);
    this.handleError(errMsg);
  }

  pageSet(page: number) {
    this.setState(prevState => {
      return {
        loading: prevState.loading,
        istioItems: prevState.istioItems,
        pagination: {
          page: page,
          perPage: prevState.pagination.perPage,
          perPageOptions: perPageOptions
        }
      };
    });
  }

  pageSelect(perPage: number) {
    this.setState(prevState => {
      return {
        loading: prevState.loading,
        istioItems: prevState.istioItems,
        pagination: {
          page: 1,
          perPage: perPage,
          perPageOptions: perPageOptions
        }
      };
    });
  }

  updateSortField(sortField: SortField) {
    this.setState(prevState => {
      return {
        currentSortField: sortField,
        istioItems: sortIstioItems(prevState.istioItems, sortField, prevState.isSortAscending)
      };
    });
  }

  updateSortDirection() {
    this.setState(prevState => {
      return {
        isSortAscending: !prevState.isSortAscending,
        istioItems: sortIstioItems(prevState.istioItems, prevState.currentSortField, !prevState.isSortAscending)
      };
    });
  }

  updateIstioConfig() {
    const activeFilters: ActiveFilter[] = NamespaceFilterSelected.getSelected();
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

    if (namespacesSelected.length === 0) {
      API.getNamespaces(authentication())
        .then(namespacesResponse => {
          const namespaces: Namespace[] = namespacesResponse['data'];
          this.fetchIstioConfig(
            namespaces.map(namespace => namespace.name),
            istioTypeFilters,
            istioNameFilters,
            configValidationFilters
          );
        })
        .catch(namespacesError => this.handleAxiosError('Could not fetch namespace list.', namespacesError));
    } else {
      this.fetchIstioConfig(namespacesSelected, istioTypeFilters, istioNameFilters, configValidationFilters);
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
    configValidationFilters: string[]
  ) {
    const istioConfigPromises = namespaces.map(namespace =>
      API.getIstioConfig(authentication(), namespace, istioTypeFilters)
    );
    const validationPromises = namespaces.map(namespace => API.getNamespaceValidations(authentication(), namespace));
    Promise.all(istioConfigPromises)
      .then(responses => {
        let istioItems: IstioConfigItem[] = [];
        responses.forEach(response => {
          istioItems = istioItems.concat(toIstioItems(filterByName(response.data, istioNameFilters)));
        });
        istioItems = sortIstioItems(istioItems, this.state.currentSortField, this.state.isSortAscending);
        this.setState(prevState => {
          return {
            loading: false,
            istioItems: istioItems,
            pagination: {
              page: 1,
              perPage: prevState.pagination.perPage,
              perPageOptions: perPageOptions
            }
          };
        });
        return Promise.all(validationPromises);
      })
      .then(responses => {
        let namespaceValidations: NamespaceValidations = {};
        responses.forEach(response =>
          Object.keys(response.data).forEach(namespace => (namespaceValidations[namespace] = response.data[namespace]))
        );
        this.setState(prevState => {
          return {
            istioItems: filterByConfigValidation(
              this.updateValidation(prevState.istioItems, namespaceValidations),
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
    } else if (istioItem.type === 'routerule') {
      iconName = 'code-fork';
      iconType = 'fa';
      type = 'RouteRule';
    } else if (istioItem.type === 'destinationpolicy') {
      iconName = 'network';
      iconType = 'pf';
      type = 'DestinationPolicy';
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
    }
    to = to + '/' + dicIstioType[type] + '/' + name;

    const itemDescription = (
      <table style={{ width: '30em', tableLayout: 'fixed' }}>
        <tbody>
          <tr>
            <td>{type}</td>
            {istioItem.validation ? (
              <td>
                <ConfigIndicator id={index + '-config-validation'} validation={istioItem.validation} />
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
    pageEnd = pageEnd < this.state.istioItems.length ? pageEnd : this.state.istioItems.length;

    for (let i = pageStart; i < pageEnd; i++) {
      istioList.push(this.renderIstioItem(this.state.istioItems[i], i));
    }

    let ruleListComponent;
    ruleListComponent = (
      <>
        <NamespaceFilter
          initialFilters={[istioTypeFilter, istioNameFilter, configValidationFilter]}
          onFilterChange={this.filterChange}
          onError={this.handleError}
        >
          <Sort>
            <Sort.TypeSelector
              sortTypes={sortFields}
              currentSortType={this.state.currentSortField}
              onSortTypeSelected={this.updateSortField}
            />
            <Sort.DirectionSelector
              isNumeric={false}
              isAscending={this.state.isSortAscending}
              onClick={this.updateSortDirection}
            />
          </Sort>
        </NamespaceFilter>
        <ListView>{istioList}</ListView>
        <Paginator
          viewType="list"
          pagination={this.state.pagination}
          itemCount={this.state.istioItems.length}
          onPageSet={this.pageSet}
          onPerPageSelect={this.pageSelect}
        />
      </>
    );
    return <div>{ruleListComponent}</div>;
  }
}

export default IstioConfigListComponent;
