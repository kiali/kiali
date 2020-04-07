import * as React from 'react';
import {
  Chip,
  ChipGroup,
  ChipGroupToolbarItem,
  FormSelect,
  FormSelectOption,
  Select,
  SelectOption,
  SelectVariant,
  TextInput,
  TextInputTypes,
  Toolbar,
  ToolbarGroup,
  ToolbarItem,
  ToolbarSection
} from '@patternfly/react-core';
import { ActiveFilter, FILTER_ACTION_UPDATE, FilterType, FilterTypes } from '../../types/Filters';
import * as FilterHelper from '../FilterList/FilterHelper';
import { PromisesRegistry } from '../../utils/CancelablePromises';
import { style } from 'typestyle';

var classNames = require('classnames');

export interface StatefulFiltersProps {
  onFilterChange: () => void;
  initialFilters: FilterType[];
  rightToolbar?: JSX.Element[];
}

export interface StatefulFiltersState {
  filterTypes: FilterType[];
  currentFilterType: FilterType;
  activeFilters: ActiveFilter[];
  currentValue: string;
  isExpanded: boolean;
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
const rightToolbar = style({
  marginLeft: 'auto'
});

const dividerStyle = style({ borderRight: '1px solid #d1d1d1;', padding: '10px', display: 'inherit' });
const paddingStyle = style({ padding: '10px' });

export class StatefulFilters extends React.Component<StatefulFiltersProps, StatefulFiltersState> {
  private promises = new PromisesRegistry();

  constructor(props: StatefulFiltersProps) {
    super(props);

    let active = FilterSelected.getSelected();
    if (!FilterSelected.isInitialized()) {
      active = FilterHelper.getFiltersFromURL(this.props.initialFilters);
      FilterSelected.setSelected(active);
    } else if (!FilterHelper.filtersMatchURL(this.props.initialFilters, active)) {
      active = FilterHelper.setFiltersToURL(this.props.initialFilters, active);
      FilterSelected.setSelected(active);
    }

    this.state = {
      currentFilterType: this.props.initialFilters[0],
      filterTypes: this.props.initialFilters,
      activeFilters: active,
      isExpanded: false,
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
    if (!FilterHelper.filtersMatchURL(this.state.filterTypes, this.state.activeFilters)) {
      FilterHelper.setFiltersToURL(this.state.filterTypes, this.state.activeFilters);
    }
  }

  componentWillUnmount() {
    this.promises.cancelAll();
  }

  updateActiveFilters(activeFilters: ActiveFilter[]) {
    const cleanFilters = FilterHelper.setFiltersToURL(this.state.filterTypes, activeFilters);
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

  selectFilterType = (value: string) => {
    const { currentFilterType } = this.state;
    const filterType = this.state.filterTypes.filter(filter => filter.id === value)[0];

    if (currentFilterType !== filterType) {
      this.setState({
        currentValue: '',
        currentFilterType: filterType
      });
    }
  };

  filterValueAheadSelected = (_event: any, value: any) => {
    this.filterValueSelected(value);
    this.setState({ isExpanded: false });
  };

  filterValueSelected = (value: any) => {
    const { currentFilterType, currentValue } = this.state;
    const filterValue = currentFilterType.filterValues.filter(filter => filter.id === value)[0];

    if (
      filterValue &&
      filterValue.id !== currentValue &&
      !this.duplicatesFilter(currentFilterType, filterValue.title)
    ) {
      this.filterAdded(currentFilterType, filterValue.title);
    }
  };

  updateCurrentValue = value => {
    this.setState({ currentValue: value });
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

  removeFilter = (category: string, value: string) => {
    const { activeFilters } = this.state;
    const index = activeFilters.findIndex(x => x.category === category && x.value === value);

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
    if (currentFilterType.filterType === FilterTypes.typeAhead) {
      return (
        <Select
          value={'default'}
          onSelect={this.filterValueAheadSelected}
          onToggle={this.onToggle}
          variant={SelectVariant.typeahead}
          isExpanded={this.state.isExpanded}
          aria-label="filter_select_value"
          placeholderText={currentFilterType.placeholder}
          width={'auto'}
        >
          {currentFilterType.filterValues.map((filter, index) => (
            <SelectOption key={'filter_' + index} value={filter.id} label={filter.title} />
          ))}
        </Select>
      );
    } else if (currentFilterType.filterType === FilterTypes.select) {
      return (
        <FormSelect
          value={'default'}
          onChange={this.filterValueSelected}
          aria-label="filter_select_value"
          style={{ width: 'auto' }}
        >
          <FormSelectOption key={'filter_default'} value={'default'} label={currentFilterType.placeholder} />
          {currentFilterType.filterValues.map((filter, index) => (
            <FormSelectOption key={'filter_' + index} value={filter.id} label={filter.title} />
          ))}
        </FormSelect>
      );
    } else if (currentFilterType.filterType === FilterTypes.label) {
      const instance = new currentFilterType.customComponent({
        value: currentValue,
        onChange: this.updateCurrentValue,
        filterAdd: value => this.filterAdded(currentFilterType, value),
        duplicatesFilter: value => this.duplicatesFilter(currentFilterType, value)
      });
      return instance.render();
    } else {
      return (
        <TextInput
          type={currentFilterType.filterType as TextInputTypes}
          value={currentValue}
          aria-label={'filter_input_value'}
          placeholder={currentFilterType.placeholder}
          onChange={this.updateCurrentValue}
          onKeyPress={e => this.onValueKeyPress(e)}
          style={{ width: 'auto' }}
        />
      );
    }
  }

  groupBy = (items, key) =>
    items.reduce(
      (result, item) => ({
        ...result,
        [item[key]]: [...(result[item[key]] || []), item]
      }),
      {}
    );

  renderChildren = () => {
    return (
      <ToolbarGroup>
        {Array.isArray(this.props.children) ? (
          (this.props.children as Array<any>).map(
            (child, index) =>
              child && (
                <ToolbarItem
                  key={'toolbar_statefulFilters_' + index}
                  className={classNames(
                    'pf-u-mr-md',
                    index === (this.props.children as Array<any>).length - 1 ? paddingStyle : dividerStyle
                  )}
                >
                  {child}
                </ToolbarItem>
              )
          )
        ) : (
          <ToolbarItem>{this.props.children}</ToolbarItem>
        )}
      </ToolbarGroup>
    );
  };

  renderRightToolbar = () => {
    return (
      <Toolbar className={rightToolbar}>
        {this.props.rightToolbar ||
          [].map((elem, index) => <ToolbarItem key={'Item_rightToolbar_' + index}>{elem}</ToolbarItem>)}
      </Toolbar>
    );
  };

  onToggle = isExpanded => {
    this.setState({
      isExpanded: isExpanded
    });
  };

  render() {
    const { currentFilterType, activeFilters } = this.state;

    return (
      <Toolbar className="pf-l-toolbar pf-u-justify-content-space-between pf-u-mx-xl pf-u-my-md">
        <ToolbarSection aria-label="ToolbarSection">
          <ToolbarGroup style={{ marginRight: '0px' }}>
            <ToolbarItem className={classNames(this.props.children ? dividerStyle : '', 'pf-u-mr-xl')}>
              <FormSelect
                value={currentFilterType.id}
                aria-label={'filter_select_type'}
                onChange={this.selectFilterType}
                style={{ width: 'auto', backgroundColor: '#ededed', borderColor: '#bbb' }}
              >
                {this.state.filterTypes.map(option => (
                  <FormSelectOption key={option.id} value={option.id} label={option.title} />
                ))}
              </FormSelect>
              {this.renderInput()}
            </ToolbarItem>
          </ToolbarGroup>
          {this.renderChildren()}
          {this.props.rightToolbar && this.renderRightToolbar()}
        </ToolbarSection>
        {activeFilters && activeFilters.length > 0 && (
          <ToolbarSection aria-label="FiltersSection">
            <>{'Active Filters:'}</>
            <div style={{ marginLeft: '5px', display: 'inline-flex', height: '80%' }}>
              <ChipGroup defaultIsOpen={true} withToolbar={true}>
                {Object.entries(this.groupBy(activeFilters, 'category')).map(([category, item]) => (
                  <ChipGroupToolbarItem key={category} categoryName={category}>
                    {(item as Array<ActiveFilter>).map(subItem => (
                      <Chip
                        key={'filter_' + category + '_' + subItem.value}
                        onClick={() => this.removeFilter(category, subItem.value)}
                      >
                        {subItem.value}
                      </Chip>
                    ))}
                  </ChipGroupToolbarItem>
                ))}
              </ChipGroup>
            </div>
            <a
              href="#"
              onClick={e => {
                e.preventDefault();
                this.clearFilters();
              }}
              style={{ marginLeft: '5px' }}
            >
              Clear All Filters
            </a>
          </ToolbarSection>
        )}
      </Toolbar>
    );
  }
}
