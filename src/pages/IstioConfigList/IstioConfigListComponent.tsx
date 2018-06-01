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
  filterByName,
  IstioConfigItem,
  SortField,
  sortIstioItems,
  toIstioItems
} from '../../types/IstioConfigListComponent';
import PropTypes from 'prop-types';
// import IstioRuleListDescription from './IstioRuleListDescription';
import { Link } from 'react-router-dom';
import { PfColors } from '../../components/Pf/PfColors';
import { authentication } from '../../utils/Authentication';

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
      id: 'Rule',
      title: 'Rule'
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

    if (namespacesSelected.length === 0) {
      API.getNamespaces(authentication())
        .then(namespacesResponse => {
          const namespaces: Namespace[] = namespacesResponse['data'];
          this.fetchIstioConfig(namespaces.map(namespace => namespace.name), istioTypeFilters, istioNameFilters);
        })
        .catch(namespacesError => this.handleAxiosError('Could not fetch namespace list.', namespacesError));
    } else {
      this.fetchIstioConfig(namespacesSelected, istioTypeFilters, istioNameFilters);
    }
  }

  fetchIstioConfig(namespaces: string[], istioTypeFilters: string[], istioNameFilters: string[]) {
    const promises = namespaces.map(namespace => API.getIstioConfig(authentication(), namespace, istioTypeFilters));
    Promise.all(promises)
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
      })
      .catch(istioError => this.handleAxiosError('Could not fetch Istio objects list.', istioError));
  }

  renderIstioItem(istioItem: IstioConfigItem, index: number) {
    let to = '/namespaces/' + istioItem.namespace + '/istio';
    let name = '';
    let iconName = '';
    let iconType = '';
    let type = 'No type found';
    if (istioItem.routeRule) {
      name = istioItem.routeRule.name;
      iconName = 'code-fork';
      iconType = 'fa';
      type = 'RouteRule';
    } else if (istioItem.destinationPolicy) {
      name = istioItem.destinationPolicy.name;
      iconName = 'network';
      iconType = 'pf';
      type = 'DestinationPolicy';
    } else if (istioItem.virtualService) {
      name = istioItem.virtualService.name;
      iconName = 'code-fork';
      iconType = 'fa';
      type = 'VirtualService';
    } else if (istioItem.destinationRule) {
      name = istioItem.destinationRule.name;
      iconName = 'network';
      iconType = 'pf';
      type = 'DestinationRule';
    } else if (istioItem.rule) {
      iconName = 'migration';
      iconType = 'pf';
      name = istioItem.rule.name;
      type = 'Rule';
    }
    to = to + '/' + dicIstioType[type] + '/' + name;
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
          description={<div>{type}</div>}
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
          initialFilters={[istioTypeFilter, istioNameFilter]}
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
