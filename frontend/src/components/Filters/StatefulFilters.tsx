import * as React from 'react';
import {
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
  SelectOptionObject,
  ToolbarContent,
  ToolbarFilter
} from '@patternfly/react-core';
import {
  ActiveFilter,
  ActiveFiltersInfo,
  DEFAULT_LABEL_OPERATION,
  FILTER_ACTION_UPDATE,
  FilterType,
  AllFilterTypes,
  LabelOperation
} from '../../types/Filters';
import * as FilterHelper from '../FilterList/FilterHelper';
import { PromisesRegistry } from '../../utils/CancelablePromises';
import { style } from 'typestyle';
import { LabelFilters } from './LabelFilter';
import { arrayEquals } from 'utils/Common';
import { labelFilter } from './CommonFilters';

var classNames = require('classnames');

const toolbarStyle = style({
  padding: 0,
  rowGap: 'var(--pf-global--spacer--md)',
  $nest: {
    '& > .pf-c-toolbar__content': {
      paddingLeft: 0
    }
  }
});

const bottomPadding = style({
  paddingBottom: 'var(--pf-global--spacer--md)'
});

export interface StatefulFiltersProps {
  onFilterChange: (active: ActiveFiltersInfo) => void;
  initialFilters: FilterType[];
  ref?: React.RefObject<StatefulFilters>;
  childrenFirst?: boolean;
}

interface StatefulFiltersState {
  activeFilters: ActiveFiltersInfo;
  filterTypes: FilterType[];
  currentFilterType: FilterType;
  currentValue: string;
  isOpen: boolean;
}

export class FilterSelected {
  static selectedFilters: ActiveFilter[] | undefined = undefined;
  static opSelected: LabelOperation;

  static init = (filterTypes: FilterType[]) => {
    let active = FilterSelected.getSelected();
    if (!FilterSelected.isInitialized()) {
      active = FilterHelper.getFiltersFromURL(filterTypes);
      FilterSelected.setSelected(active);
    } else if (!FilterHelper.filtersMatchURL(filterTypes, active)) {
      active = FilterHelper.setFiltersToURL(filterTypes, active);
      FilterSelected.setSelected(active);
    }
    return active;
  };

  static resetFilters = () => {
    FilterSelected.selectedFilters = undefined;
  };

  static setSelected = (activeFilters: ActiveFiltersInfo) => {
    FilterSelected.selectedFilters = activeFilters.filters;
    FilterSelected.opSelected = activeFilters.op;
  };

  static getSelected = (): ActiveFiltersInfo => {
    return { filters: FilterSelected.selectedFilters || [], op: FilterSelected.opSelected || 'or' };
  };

  static isInitialized = () => {
    return FilterSelected.selectedFilters !== undefined;
  };
}

const dividerStyle = style({ borderRight: '1px solid #d1d1d1;', padding: '10px', display: 'inherit' });
const paddingStyle = style({ padding: '10px' });

export class StatefulFilters extends React.Component<StatefulFiltersProps, StatefulFiltersState> {
  private promises = new PromisesRegistry();

  constructor(props: StatefulFiltersProps) {
    super(props);
    this.state = {
      currentFilterType: this.props.initialFilters[0],
      filterTypes: this.props.initialFilters,
      activeFilters: FilterSelected.init(this.props.initialFilters),
      isOpen: false,
      currentValue: ''
    };
  }

  componentDidMount() {
    this.loadDynamicFilters();
  }

  private loadDynamicFilters() {
    // Call all loaders from FilterTypes and set results in state
    const filterTypePromises = this.props.initialFilters.map(ft => {
      if (ft.loader) {
        return ft.loader().then(values => {
          ft.filterValues = values;
          return {
            category: ft.category,
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

    this.promises
      .registerAll('filterType', filterTypePromises)
      .then(types => this.setState({ filterTypes: types }))
      .catch(err => {
        if (!err.isCanceled) {
          console.debug(err);
        }
      });
  }

  componentDidUpdate(prev: StatefulFiltersProps) {
    // If the props filters changed (e.g. different values), some state update is necessary
    if (
      this.props.initialFilters !== prev.initialFilters &&
      !arrayEquals(this.props.initialFilters, prev.initialFilters, (t1, t2) => {
        return (
          t1.category === t2.category &&
          arrayEquals(t1.filterValues, t2.filterValues, (v1, v2) => {
            return v1.id === v2.id && v1.title === v2.title;
          })
        );
      })
    ) {
      const current =
        this.props.initialFilters.find(f => f.category === this.state.currentFilterType.category) ||
        this.props.initialFilters[0];
      const active = FilterHelper.setFiltersToURL(this.props.initialFilters, this.state.activeFilters);
      this.setState({
        currentFilterType: current,
        filterTypes: this.props.initialFilters,
        activeFilters: active
      });
      this.loadDynamicFilters();
    } else if (!FilterHelper.filtersMatchURL(this.state.filterTypes, this.state.activeFilters)) {
      FilterHelper.setFiltersToURL(this.state.filterTypes, this.state.activeFilters);
    }
  }

  componentWillUnmount() {
    this.promises.cancelAll();
  }

  updateActiveFilters(activeFilters: ActiveFiltersInfo) {
    const cleanFilters = FilterHelper.setFiltersToURL(this.state.filterTypes, activeFilters);
    FilterSelected.setSelected(cleanFilters);
    this.setState({ activeFilters: cleanFilters, currentValue: '' });
    this.props.onFilterChange(cleanFilters);
  }

  filterAdded = (field: FilterType, value: string) => {
    const activeFilters = this.state.activeFilters;
    const activeFilter: ActiveFilter = {
      category: field.category,
      value: value
    };

    // For filters that need to be updated in place instead of added, we check if it is already defined in activeFilters
    const current = activeFilters.filters.filter(filter => filter.category === field.category);
    if (field.action === FILTER_ACTION_UPDATE && current.length > 0) {
      current.forEach(filter => (filter.value = value));
    } else {
      activeFilters.filters.push(activeFilter);
    }

    this.updateActiveFilters(activeFilters);
  };

  selectFilterType = (value: string) => {
    const { currentFilterType } = this.state;
    const filterType = this.state.filterTypes.filter(filter => filter.category === value)[0];

    if (currentFilterType !== filterType) {
      this.setState({
        currentValue: '',
        currentFilterType: filterType
      });
    }
  };

  filterValueAheadSelected = (_event: any, valueId: string | SelectOptionObject) => {
    this.filterValueSelected(valueId);
    this.setState({ isOpen: false });
  };

  filterValueSelected = (valueId: string | SelectOptionObject) => {
    const { currentFilterType, currentValue } = this.state;
    const filterValue = currentFilterType.filterValues.find(filter => filter.id === valueId);

    if (filterValue && filterValue.id !== currentValue && !this.isActive(currentFilterType, filterValue.title)) {
      this.filterAdded(currentFilterType, filterValue.title);
    }
  };

  updateCurrentValue = value => {
    this.setState({ currentValue: value });
  };

  onValueKeyPress = (keyEvent: any) => {
    const { currentValue, currentFilterType } = this.state;

    if (keyEvent.key === 'Enter') {
      if (currentValue && currentValue.length > 0 && !this.isActive(currentFilterType, currentValue)) {
        this.filterAdded(currentFilterType, currentValue);
      }

      this.setState({ currentValue: '' });
      keyEvent.stopPropagation();
      keyEvent.preventDefault();
    }
  };

  isActive = (type: FilterType, value: string): boolean => {
    return this.state.activeFilters.filters.some(active => value === active.value && type.category === active.category);
  };

  removeFilter = (category: string | any, value: string | any) => {
    const updated = this.state.activeFilters.filters.filter(x => x.category !== category || x.value !== value);
    if (updated.length !== this.state.activeFilters.filters.length) {
      this.updateActiveFilters({ filters: updated, op: this.state.activeFilters.op });
    }
  };

  clearFilters = () => {
    this.updateActiveFilters({ filters: [], op: DEFAULT_LABEL_OPERATION });
  };

  renderInput() {
    const { currentFilterType, currentValue } = this.state;

    if (!currentFilterType) {
      return null;
    }
    if (currentFilterType.filterType === AllFilterTypes.typeAhead) {
      return (
        <Select
          value="default"
          onSelect={this.filterValueAheadSelected}
          onToggle={this.onToggle}
          variant={SelectVariant.typeahead}
          isOpen={this.state.isOpen}
          aria-label="filter_select_value"
          placeholderText={currentFilterType.placeholder}
          width="auto"
        >
          {currentFilterType.filterValues.map((filter, index) => (
            <SelectOption key={'filter_' + index} value={filter.id} label={filter.title} />
          ))}
        </Select>
      );
    } else if (currentFilterType.filterType === AllFilterTypes.select) {
      return (
        <FormSelect
          value="default"
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
    } else if (
      currentFilterType.filterType === AllFilterTypes.label ||
      currentFilterType.filterType === AllFilterTypes.nsLabel
    ) {
      return (
        <LabelFilters
          value={currentValue}
          onChange={this.updateCurrentValue}
          filterAdd={value => this.filterAdded(currentFilterType, value)}
          isActive={value => this.isActive(currentFilterType, value)}
        />
      );
    } else {
      return (
        <TextInput
          type={currentFilterType.filterType as TextInputTypes}
          value={currentValue}
          aria-label="filter_input_value"
          placeholder={currentFilterType.placeholder}
          onChange={this.updateCurrentValue}
          onKeyPress={e => this.onValueKeyPress(e)}
          style={{ width: 'auto' }}
        />
      );
    }
  }

  renderChildren = () => {
    return (
      this.props.children && (
        <ToolbarGroup style={{ marginRight: '10px' }}>
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
      )
    );
  };

  onToggle = isOpen => {
    this.setState({
      isOpen: isOpen
    });
  };

  render() {
    const { currentFilterType, activeFilters } = this.state;
    const filterOptions = this.state.filterTypes.map(option => (
      <FormSelectOption key={option.category} value={option.category} label={option.category} />
    ));
    const hasActiveFilters =
      this.state.activeFilters.filters.some(f => f.category === labelFilter.category) ||
      this.state.currentFilterType.filterType === AllFilterTypes.label;

    return (
      <>
        <Toolbar id="filter-selection" className={toolbarStyle} clearAllFilters={this.clearFilters}>
          {this.props.childrenFirst && this.renderChildren()}
          <ToolbarContent>
            <ToolbarGroup variant="filter-group">
              {this.state.filterTypes.map((ft, i) => {
                return (
                  <ToolbarFilter
                    key={`toolbar_filter-${ft.category}`}
                    chips={activeFilters.filters.filter(af => af.category === ft.category).map(af => af.value)}
                    deleteChip={this.removeFilter}
                    categoryName={ft.category}
                  >
                    {i === 0 && (
                      <FormSelect
                        value={currentFilterType.category}
                        aria-label="filter_select_type"
                        onChange={this.selectFilterType}
                        style={{ width: 'auto', backgroundColor: '#ededed', borderColor: '#bbb' }}
                      >
                        {filterOptions}
                      </FormSelect>
                    )}
                    {i === 0 && this.renderInput()}
                  </ToolbarFilter>
                );
              })}
            </ToolbarGroup>
            {!this.props.childrenFirst && this.renderChildren()}
            {hasActiveFilters && (
              <ToolbarGroup>
                <ToolbarItem className={classNames('pf-u-mr-md')}>
                  <span className={classNames(paddingStyle)}>Label Operation</span>
                  <FormSelect
                    value={activeFilters.op}
                    onChange={value =>
                      this.updateActiveFilters({
                        filters: this.state.activeFilters.filters,
                        op: value as LabelOperation
                      })
                    }
                    aria-label="filter_select_value"
                    style={{ width: 'auto' }}
                  >
                    <FormSelectOption key="filter_or" value="or" label="or" />
                    <FormSelectOption key="filter_and" value="and" label="and" />
                  </FormSelect>
                </ToolbarItem>
              </ToolbarGroup>
            )}
          </ToolbarContent>
        </Toolbar>
        <div className={bottomPadding} />
      </>
    );
  }
}
