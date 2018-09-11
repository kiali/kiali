import * as React from 'react';
import { Button, Icon, ListView, ListViewItem, ListViewIcon, Sort, ToolbarRightContent } from 'patternfly-react';
import { AxiosError } from 'axios';
import {
  defaultNamespaceFilter,
  NamespaceFilter,
  NamespaceFilterSelected
} from '../../components/NamespaceFilter/NamespaceFilter';
import { Paginator } from 'patternfly-react';
import { ActiveFilter, FILTER_ACTION_APPEND, FILTER_ACTION_UPDATE, FilterType } from '../../types/NamespaceFilter';
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
import { Link } from 'react-router-dom';
import { PfColors } from '../../components/Pf/PfColors';
import { authentication } from '../../utils/Authentication';
import { NamespaceValidations } from '../../types/IstioObjects';
import { ConfigIndicator } from '../../components/ConfigValidation/ConfigIndicator';
import { removeDuplicatesArray } from '../../utils/Common';
import { URLParameter } from '../../types/Parameters';
import { ListPage } from '../../components/ListPage/ListPage';

export const sortFields: SortField[] = [
  {
    id: 'namespace',
    title: 'Namespace',
    isNumeric: false,
    param: 'ns'
  },
  {
    id: 'istiotype',
    title: 'Istio Type',
    isNumeric: false,
    param: 'it'
  },
  {
    id: 'istioname',
    title: 'Istio Name',
    isNumeric: false,
    param: 'in'
  },
  {
    id: 'configvalidation',
    title: 'Config',
    isNumeric: false,
    param: 'cv'
  }
];

const istioNameFilter: FilterType = {
  id: 'istioname',
  title: 'Istio Name',
  placeholder: 'Filter by Istio Name',
  filterType: 'text',
  action: FILTER_ACTION_UPDATE,
  filterValues: []
};

const istioTypeFilter: FilterType = {
  id: 'istiotype',
  title: 'Istio Type',
  placeholder: 'Filter by Istio Type',
  filterType: 'select',
  action: FILTER_ACTION_APPEND,
  filterValues: [
    {
      id: 'Gateway',
      title: 'Gateway'
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
    },
    {
      id: 'QuotaSpec',
      title: 'QuotaSpec'
    },
    {
      id: 'QuotaSpecBinding',
      title: 'QuotaSpecBinding'
    }
  ]
};

const configValidationFilter: FilterType = {
  id: 'configvalidation',
  title: 'Config',
  placeholder: 'Filter by Config Validation',
  filterType: 'select',
  action: FILTER_ACTION_APPEND,
  filterValues: [
    {
      id: 'valid',
      title: 'Valid'
    },
    {
      id: 'warning',
      title: 'Warning'
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

const availableFilters: FilterType[] = [
  istioTypeFilter,
  istioNameFilter,
  configValidationFilter,
  defaultNamespaceFilter
];

type IstioConfigListComponentState = {
  istioItems: IstioConfigItem[];
  pagination: Pagination;
  currentSortField: SortField;
  isSortAscending: boolean;
};

type IstioConfigListComponentProps = {
  pageHooks: ListPage.Hooks;
  pagination: Pagination;
  currentSortField: SortField;
  isSortAscending: boolean;
};

class IstioConfigListComponent extends React.Component<IstioConfigListComponentProps, IstioConfigListComponentState> {
  constructor(props: IstioConfigListComponentProps) {
    super(props);
    this.state = {
      istioItems: [],
      pagination: this.props.pagination,
      currentSortField: this.props.currentSortField,
      isSortAscending: this.props.isSortAscending
    };

    this.setActiveFiltersToURL();
  }

  componentDidMount() {
    this.updateIstioConfig();
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

      NamespaceFilterSelected.setSelected(this.selectedFilters());
      this.updateIstioConfig();
    }
  }

  paramsAreSynced(prevProps: IstioConfigListComponentProps) {
    return (
      prevProps.pagination.page === this.props.pagination.page &&
      prevProps.pagination.perPage === this.props.pagination.perPage &&
      prevProps.isSortAscending === this.props.isSortAscending &&
      prevProps.currentSortField.title === this.props.currentSortField.title &&
      this.filtersMatch()
    );
  }

  filtersMatch() {
    const selectedFilters: Map<string, string[]> = new Map<string, string[]>();

    NamespaceFilterSelected.getSelected().map(activeFilter => {
      const existingValue = selectedFilters.get(activeFilter.category) || [];
      selectedFilters.set(activeFilter.category, existingValue.concat(activeFilter.value));
    });

    let urlParams: Map<string, string[]> = new Map<string, string[]>();
    availableFilters.forEach(filter => {
      const param = this.props.pageHooks.getQueryParam(filter.id);
      if (param !== undefined) {
        const existing = urlParams.get(filter.title) || [];
        urlParams.set(filter.title, existing.concat(param));
      }
    });

    let equalFilters = true;
    selectedFilters.forEach((filterValues, filterName) => {
      const aux = urlParams.get(filterName) || [];
      equalFilters =
        equalFilters && filterValues.every(value => aux.includes(value)) && filterValues.length === aux.length;
    });

    return selectedFilters.size === urlParams.size && equalFilters;
  }

  setActiveFiltersToURL() {
    const params = NamespaceFilterSelected.getSelected()
      .map(activeFilter => {
        const availableFilter = availableFilters.find(filter => {
          return filter.title === activeFilter.category;
        });

        if (typeof availableFilter === 'undefined') {
          NamespaceFilterSelected.setSelected(
            NamespaceFilterSelected.getSelected().filter(nfs => {
              return nfs.category !== activeFilter.category;
            })
          );
          return null;
        }

        return {
          name: availableFilter.id,
          value: activeFilter.value
        };
      })
      .filter(filter => filter !== null) as URLParameter[];

    this.props.pageHooks.onParamChange(params, 'append', 'replace');
  }

  selectedFilters() {
    let activeFilters: ActiveFilter[] = [];
    availableFilters.forEach(filter => {
      (this.props.pageHooks.getQueryParam(filter.id) || []).forEach(value => {
        activeFilters.push({
          label: filter.title + ': ' + value,
          category: filter.title,
          value: value
        });
      });
    });

    return activeFilters;
  }

  onFilterChange = (filters: ActiveFilter[]) => {
    let params: URLParameter[] = [];

    availableFilters.forEach(availableFilter => {
      params.push({ name: availableFilter.id, value: '' });
    });

    filters.forEach(activeFilter => {
      let filterId = (
        availableFilters.find(filter => {
          return filter.title === activeFilter.category;
        }) || availableFilters[2]
      ).id;

      params.push({
        name: filterId,
        value: activeFilter.value
      });
    });

    // Resetting pagination when filters change
    params.push({ name: 'page', value: '' });

    this.props.pageHooks.onParamChange(params, 'append');
    this.updateIstioConfig(true);
  };

  handleError = (error: string) => {
    this.props.pageHooks.handleError(error);
  };

  handleAxiosError(message: string, error: AxiosError) {
    const errMsg = API.getErrorMsg(message, error);
    console.error(errMsg);
    this.handleError(errMsg);
  }

  pageSet = (page: number) => {
    this.setState(prevState => {
      return {
        istioItems: prevState.istioItems,
        pagination: {
          page: page,
          perPage: prevState.pagination.perPage
        }
      };
    });

    this.props.pageHooks.onParamChange([{ name: 'page', value: String(page) }]);
  };

  pageSelect = (perPage: number) => {
    this.setState(prevState => {
      return {
        istioItems: prevState.istioItems,
        pagination: {
          page: 1,
          perPage: perPage
        }
      };
    });

    this.props.pageHooks.onParamChange([{ name: 'page', value: '1' }, { name: 'perPage', value: String(perPage) }]);
  };

  updateSortField = (sortField: SortField) => {
    this.setState(prevState => {
      return {
        currentSortField: sortField,
        istioItems: sortIstioItems(prevState.istioItems, sortField, prevState.isSortAscending)
      };
    });

    this.props.pageHooks.onParamChange([{ name: 'sort', value: sortField.param }]);
  };

  updateSortDirection = () => {
    this.setState(prevState => {
      return {
        isSortAscending: !prevState.isSortAscending,
        istioItems: sortIstioItems(prevState.istioItems, prevState.currentSortField, !prevState.isSortAscending)
      };
    });

    this.props.pageHooks.onParamChange([{ name: 'direction', value: this.state.isSortAscending ? 'desc' : 'asc' }]);
  };

  updateIstioConfig = (resetPagination?: boolean) => {
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
  };

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
        istioItems = sortIstioItems(istioItems, this.state.currentSortField, this.state.isSortAscending);
        this.setState(prevState => {
          return {
            istioItems: istioItems,
            pagination: {
              page: currentPage,
              perPage: prevState.pagination.perPage
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
    pageEnd = pageEnd < this.state.istioItems.length ? pageEnd : this.state.istioItems.length;

    for (let i = pageStart; i < pageEnd; i++) {
      istioList.push(this.renderIstioItem(this.state.istioItems[i], i));
    }

    let ruleListComponent;
    ruleListComponent = (
      <>
        <NamespaceFilter
          initialFilters={[istioTypeFilter, istioNameFilter, configValidationFilter]}
          initialActiveFilters={this.selectedFilters()}
          onFilterChange={this.onFilterChange}
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
          <ToolbarRightContent>
            <Button onClick={this.updateIstioConfig}>
              <Icon name="refresh" />
            </Button>
          </ToolbarRightContent>
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
