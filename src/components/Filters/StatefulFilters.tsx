import * as React from 'react';
import { Filter, FormControl, Toolbar } from 'patternfly-react';
import { ActiveFilter, FILTER_ACTION_UPDATE, FilterType, FilterValue } from '../../types/Filters';
import * as ListPagesHelper from '../ListPage/ListPagesHelper';
import { PromisesRegistry } from '../../utils/CancelablePromises';

export interface StatefulFiltersProps {
  onFilterChange: () => void;
  initialFilters: FilterType[];
}

export interface StatefulFiltersState {
  filterTypes: FilterType[];
  currentFilterType: FilterType;
  activeFilters: ActiveFilter[];
  currentValue: string;
}

export class FilterSelected {
  static selectedFilters: ActiveFilter[] | undefined = undefined;

  static setSelected = (activeFilters: ActiveFilter[]) => {
    FilterSelected.selectedFilters = activeFilters;
  };

  static getSelected = (): ActiveFilter[] => {
    return FilterSelected.selectedFilters || [];
  };

  static isInitialized = () => {
    return FilterSelected.selectedFilters !== undefined;
  };
}

// align with separator start
const alignLeftStyle = {
  marginLeft: '-20px'
};

// reduce toolbar padding from 20px to 10px. save horiz space at border lines and match OS console
const thinBorderStyle = {
  paddingRight: '10px'
};

export class StatefulFilters extends React.Component<StatefulFiltersProps, StatefulFiltersState> {
  private promises = new PromisesRegistry();

  constructor(props: StatefulFiltersProps) {
    super(props);

    let active = FilterSelected.getSelected();
    if (!FilterSelected.isInitialized()) {
      active = ListPagesHelper.getFiltersFromURL(this.props.initialFilters);
      FilterSelected.setSelected(active);
    } else if (!ListPagesHelper.filtersMatchURL(this.props.initialFilters, active)) {
      active = ListPagesHelper.setFiltersToURL(this.props.initialFilters, active);
      FilterSelected.setSelected(active);
    }

    this.state = {
      currentFilterType: this.props.initialFilters[0],
      filterTypes: this.props.initialFilters,
      activeFilters: active,
      currentValue: ''
    };
  }

  componentDidMount() {
    // Call all loaders from FilterTypes and set results in state
    const filterTypePromises = this.props.initialFilters.map(ft => {
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

    this.promises.registerAll('filterType', filterTypePromises).then(types => this.setState({ filterTypes: types }));
  }

  componentDidUpdate(_prevProps: StatefulFiltersProps, _prevState: StatefulFiltersState, _snapshot: any) {
    if (!ListPagesHelper.filtersMatchURL(this.state.filterTypes, this.state.activeFilters)) {
      ListPagesHelper.setFiltersToURL(this.state.filterTypes, this.state.activeFilters);
    }
  }

  componentWillUnmount() {
    this.promises.cancelAll();
  }

  updateActiveFilters(activeFilters: ActiveFilter[]) {
    const cleanFilters = ListPagesHelper.setFiltersToURL(this.state.filterTypes, activeFilters);
    FilterSelected.setSelected(cleanFilters);
    this.setState({ activeFilters: cleanFilters });
    this.props.onFilterChange();
  }

  filterAdded = (field: FilterType, value: string) => {
    const activeFilters = this.state.activeFilters;
    const activeFilter: ActiveFilter = {
      category: field.title,
      value: value
    };

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

    this.updateActiveFilters(activeFilters);
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

    const index = activeFilters.indexOf(filter);
    if (index > -1) {
      const updated = [...activeFilters.slice(0, index), ...activeFilters.slice(index + 1)];
      this.updateActiveFilters(updated);
    }
  };

  clearFilters = () => {
    this.updateActiveFilters([]);
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
          <Filter style={{ ...alignLeftStyle, ...thinBorderStyle }}>
            <Filter.TypeSelector
              filterTypes={this.state.filterTypes}
              currentFilterType={currentFilterType}
              onFilterTypeSelected={this.selectFilterType}
            />
            {this.renderInput()}
          </Filter>
          {this.props.children}
          {activeFilters && activeFilters.length > 0 && (
            <Toolbar.Results>
              <Filter.ActiveLabel>{'Active Filters:'}</Filter.ActiveLabel>
              <Filter.List>
                {activeFilters.map((item, index) => {
                  return (
                    <Filter.Item key={index} onRemove={this.removeFilter} filterData={item}>
                      {item.category + ': ' + item.value}
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
