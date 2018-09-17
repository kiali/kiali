import * as React from 'react';
import { Filter, FormControl, Toolbar } from 'patternfly-react';
import { ActiveFilter, FILTER_ACTION_UPDATE, FilterType, FilterValue } from '../../types/Filters';

export interface StatefulFiltersProps {
  onFilterChange: (filters: ActiveFilter[]) => void;
  onError: (msg: string) => void;
  initialFilters: FilterType[];
  initialActiveFilters?: ActiveFilter[];
}

export interface StatefulFiltersState {
  filterTypes: FilterType[];
  currentFilterType: FilterType;
  activeFilters: ActiveFilter[];
  currentValue: string;
}

export namespace FilterSelected {
  let selectedFilters: ActiveFilter[] = [];

  export const setSelected = (activeFilters: ActiveFilter[]) => {
    selectedFilters = activeFilters;
  };

  export const getSelected = (): ActiveFilter[] => {
    return selectedFilters;
  };
}

export class StatefulFilters extends React.Component<StatefulFiltersProps, StatefulFiltersState> {
  constructor(props: StatefulFiltersProps) {
    super(props);

    if (!!this.props.initialActiveFilters && this.props.initialActiveFilters.length > 0) {
      FilterSelected.setSelected(this.props.initialActiveFilters);
    }

    this.state = {
      currentFilterType: this.props.initialFilters[0],
      filterTypes: this.props.initialFilters,
      activeFilters: FilterSelected.getSelected(),
      currentValue: ''
    };
  }

  componentDidMount() {
    // Call all loaders from FilterTypes and set results in state
    const promises = this.props.initialFilters.map(ft => {
      if (ft.loader) {
        return ft.loader().then(values => {
          ft.filterValues = values;
          return {
            id: ft.id,
            title: ft.title,
            placeholder: ft.placeholder,
            filterType: ft.filterType,
            action: ft.action,
            filterValues: ft.filterValues
          };
        });
      } else {
        return Promise.resolve(ft);
      }
    });

    Promise.all(promises).then(types => {
      this.setState({ filterTypes: types });
    });
  }

  componentDidUpdate(prevProps: StatefulFiltersProps, prevState: StatefulFiltersState, snapshot: any) {
    const filtersExists = (prevProps.initialActiveFilters || []).every(prevFilter => {
      return (
        (this.props.initialActiveFilters || []).findIndex(filter => {
          return (
            filter.label === prevFilter.label &&
            filter.category === prevFilter.category &&
            filter.value === prevFilter.value
          );
        }) > -1
      );
    });

    if (
      this.props.initialActiveFilters &&
      prevProps.initialActiveFilters &&
      (!filtersExists || prevProps.initialActiveFilters.length !== this.props.initialActiveFilters.length)
    ) {
      this.setState({
        activeFilters: this.props.initialActiveFilters
      });
    }
  }

  filterAdded = (field: FilterType, value: string) => {
    let filterText = '';
    const activeFilters = this.state.activeFilters;
    let activeFilter: ActiveFilter = { label: '', category: '', value: '' };

    if (field.title) {
      filterText = field.title;
      activeFilter.category = field.title;
    }

    filterText += ': ' + value;
    activeFilter.value = value;
    activeFilter.label = filterText;

    const typeFilterPresent = activeFilters.filter(filter => filter.category === field.title).length > 0;

    if (field.action === FILTER_ACTION_UPDATE && typeFilterPresent) {
      activeFilters.forEach(filter => {
        if (filter.category === field.title) {
          filter.value = value;
        }
      });
    } else {
      activeFilters.push(activeFilter);
    }

    this.setState({ activeFilters: activeFilters });
    FilterSelected.setSelected(activeFilters);
    this.props.onFilterChange(activeFilters);
  };

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

    if (
      filterValue &&
      filterValue.id !== currentValue &&
      !this.duplicatesFilter(currentFilterType, filterValue.title)
    ) {
      this.filterAdded(currentFilterType, filterValue.title);
    }
  };

  updateCurrentValue = (event: any) => {
    this.setState({ currentValue: event.target.value });
  };

  onValueKeyPress = (keyEvent: any) => {
    const { currentValue, currentFilterType } = this.state;

    if (keyEvent.key === 'Enter') {
      if (currentValue && currentValue.length > 0 && !this.duplicatesFilter(currentFilterType, currentValue)) {
        this.filterAdded(currentFilterType, currentValue);
      }

      this.setState({ currentValue: '' });
      keyEvent.stopPropagation();
      keyEvent.preventDefault();
    }
  };

  duplicatesFilter = (filterType: FilterType, filterValue: string): boolean => {
    const filter = this.state.activeFilters.find(activeFilter => {
      return filterValue === activeFilter.value && filterType.title === activeFilter.category;
    });

    return !!filter;
  };

  removeFilter = (filter: ActiveFilter) => {
    const { activeFilters } = this.state;

    let index = activeFilters.indexOf(filter);
    if (index > -1) {
      let updated = [...activeFilters.slice(0, index), ...activeFilters.slice(index + 1)];
      this.setState({ activeFilters: updated });
      FilterSelected.setSelected(updated);
      this.props.onFilterChange(updated);
    }
  };

  clearFilters = () => {
    this.setState({ activeFilters: [] });
    FilterSelected.setSelected([]);
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
              filterTypes={this.state.filterTypes}
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

export default StatefulFilters;
