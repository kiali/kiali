import * as React from 'react';
import { Filter, FormControl, Toolbar } from 'patternfly-react';
import {
  ActiveFilter,
  FilterType,
  FilterValue,
  NamespaceFilterProps,
  NamespaceFilterState
} from '../../types/NamespaceFilter';
import * as API from '../../services/Api';
import { authentication } from '../../utils/Authentication';

export namespace NamespaceFilterSelected {
  let selectedFilters: ActiveFilter[] = [];

  export const setSelected = (activeFilters: ActiveFilter[]) => {
    selectedFilters = activeFilters;
  };

  export const getSelected = (): ActiveFilter[] => {
    return selectedFilters;
  };
}

export class NamespaceFilter extends React.Component<NamespaceFilterProps, NamespaceFilterState> {
  constructor(props: NamespaceFilterProps) {
    super(props);

    let namespaceFilter = {
      id: 'namespace',
      title: 'Namespace',
      placeholder: 'Filter by Namespace',
      filterType: 'select',
      filterValues: []
    };

    let initialFilters = this.initialFilterList(namespaceFilter);

    this.state = {
      currentFilterType: initialFilters[0],
      filterTypeList: initialFilters,
      activeFilters: NamespaceFilterSelected.getSelected(),
      currentValue: ''
    };
  }

  initialFilterList(namespaceFilter: FilterType) {
    return this.props.initialFilters.slice().concat(namespaceFilter);
  }

  componentDidMount() {
    this.updateNamespaces();
  }

  updateNamespaces() {
    API.getNamespaces(authentication())
      .then(response => {
        const namespaceFilter: FilterType = {
          id: 'namespace',
          title: 'Namespace',
          placeholder: 'Filter by Namespace',
          filterType: 'select',
          filterValues: response.data.map(namespace => {
            return { title: namespace.name, id: namespace.name };
          })
        };
        const initialFilters = this.initialFilterList(namespaceFilter);
        this.setState({ filterTypeList: initialFilters });
      })
      .catch(error => {
        const errMsg = API.getErrorMsg('Error fetching namespace list.', error);
        console.error(errMsg);
        this.props.onError(errMsg);
      });
  }

  filterAdded(field: any, value: any) {
    let filterText = '';
    const activeFilters = this.state.activeFilters;
    let activeFilter: ActiveFilter = { label: '', category: '', value: '' };

    if (field.title) {
      filterText = field.title;
      activeFilter.category = field.title;
    }
    filterText += ': ';

    if (value.title) {
      filterText += value.title;
      activeFilter.value = value.title;
    } else {
      filterText += value;
      activeFilter.value = value;
    }

    activeFilter.label = filterText;
    activeFilters.push(activeFilter);
    this.setState({ activeFilters: activeFilters });
    NamespaceFilterSelected.setSelected(activeFilters);
    this.props.onFilterChange(activeFilters);
  }

  selectFilterType = (filterType: FilterType) => {
    const { currentFilterType } = this.state;
    if (currentFilterType !== filterType) {
      this.setState({
        currentValue: '',
        currentFilterType: filterType
      });
    }
  };

  filterValueSelected = (filterValue: FilterValue) => {
    const { currentFilterType, currentValue } = this.state;

    if (filterValue && filterValue.id !== currentValue) {
      this.filterAdded(currentFilterType, filterValue);
    }
  };

  updateCurrentValue = (event: any) => {
    this.setState({ currentValue: event.target.value });
  };

  onValueKeyPress = (keyEvent: any) => {
    const { currentValue, currentFilterType } = this.state;

    if (keyEvent.key === 'Enter' && currentValue && currentValue.length > 0) {
      this.setState({ currentValue: '' });
      this.filterAdded(currentFilterType, currentValue);
      keyEvent.stopPropagation();
      keyEvent.preventDefault();
    }
  };

  removeFilter = (filter: ActiveFilter) => {
    const { activeFilters } = this.state;

    let index = activeFilters.indexOf(filter);
    if (index > -1) {
      let updated = [...activeFilters.slice(0, index), ...activeFilters.slice(index + 1)];
      this.setState({ activeFilters: updated });
      NamespaceFilterSelected.setSelected(updated);
      this.props.onFilterChange(updated);
    }
  };

  clearFilters = () => {
    this.setState({ activeFilters: [] });
    NamespaceFilterSelected.setSelected([]);
    this.props.onFilterChange([]);
  };

  renderInput() {
    const { currentFilterType, currentValue } = this.state;
    if (!currentFilterType) {
      return null;
    }

    if (currentFilterType.filterType === 'select') {
      return (
        <Filter.ValueSelector
          filterValues={currentFilterType.filterValues}
          placeholder={currentFilterType.placeholder}
          currentValue={currentValue}
          onFilterValueSelected={this.filterValueSelected}
        />
      );
    } else {
      return (
        <FormControl
          type={currentFilterType.filterType}
          value={currentValue}
          placeholder={currentFilterType.placeholder}
          onChange={e => this.updateCurrentValue(e)}
          onKeyPress={e => this.onValueKeyPress(e)}
        />
      );
    }
  }

  render() {
    const { currentFilterType, activeFilters } = this.state;

    return (
      <div>
        <Toolbar>
          <Filter>
            <Filter.TypeSelector
              filterTypes={this.state.filterTypeList}
              currentFilterType={currentFilterType}
              onFilterTypeSelected={this.selectFilterType}
            />
            {this.renderInput()}
          </Filter>
          {this.props.children}
          {activeFilters &&
            activeFilters.length > 0 && (
              <Toolbar.Results>
                <Filter.ActiveLabel>{'Active Filters:'}</Filter.ActiveLabel>
                <Filter.List>
                  {activeFilters.map((item, index) => {
                    return (
                      <Filter.Item key={index} onRemove={this.removeFilter} filterData={item}>
                        {item.label}
                      </Filter.Item>
                    );
                  })}
                </Filter.List>
                <a
                  href="#"
                  onClick={e => {
                    e.preventDefault();
                    this.clearFilters();
                  }}
                >
                  Clear All Filters
                </a>
              </Toolbar.Results>
            )}
        </Toolbar>
      </div>
    );
  }
}

export default NamespaceFilter;
