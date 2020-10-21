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
  ToolbarSection,
  SelectOptionObject,
  Button
} from '@patternfly/react-core';
import {
  ActiveFilter,
  ActiveFiltersInfo,
  DEFAULT_LABEL_OPERATION,
  FILTER_ACTION_UPDATE,
  FilterType,
  FilterTypes,
  LabelOperation
} from '../../types/Filters';
import * as FilterHelper from '../FilterList/FilterHelper';
import { PromisesRegistry } from '../../utils/CancelablePromises';
import { style } from 'typestyle';
import { LabelFilters } from './LabelFilter';
import { arrayEquals, groupBy } from 'utils/Common';
import { labelFilter } from './CommonFilters';

var classNames = require('classnames');

export interface StatefulFiltersProps {
  onFilterChange: (active: ActiveFiltersInfo) => void;
  initialFilters: FilterType[];
  rightToolbar?: JSX.Element[];
  ref?: React.RefObject<StatefulFilters>;
}

export interface StatefulFiltersState {
  filterTypes: FilterType[];
  currentFilterType: FilterType;
  activeFilters: ActiveFiltersInfo;
  currentValue: string;
  isExpanded: boolean;
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

const rightToolbar = style({
  marginLeft: 'auto'
});

const filterWithChildrenStyle = style({ borderRight: '1px solid #d1d1d1;', paddingRight: '10px', display: 'inherit' });
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
      isExpanded: false,
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

  componentDidUpdate(prev: StatefulFiltersProps) {
    // If the props filters changed (e.g. different values), some state update is necessary
    if (
      this.props.initialFilters !== prev.initialFilters &&
      !arrayEquals(this.props.initialFilters, prev.initialFilters, (t1, t2) => {
        return t1.id === t2.id && arrayEquals(t1.filterValues, t2.filterValues, (v1, v2) => v1 === v2);
      })
    ) {
      const current =
        this.props.initialFilters.find(f => f.id === this.state.currentFilterType.id) || this.props.initialFilters[0];
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
      id: field.id,
      title: field.title,
      value: value
    };

    // For filters that need to be updated in place instead of added, we check if it is already defined in activeFilters
    const current = activeFilters.filters.filter(filter => filter.id === field.id);
    if (field.action === FILTER_ACTION_UPDATE && current.length > 0) {
      current.forEach(filter => (filter.value = value));
    } else {
      activeFilters.filters.push(activeFilter);
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

  filterValueAheadSelected = (_event: any, valueId: string | SelectOptionObject) => {
    this.filterValueSelected(valueId);
    this.setState({ isExpanded: false });
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
    return this.state.activeFilters.filters.some(active => value === active.value && type.id === active.id);
  };

  removeFilter = (id: string, value: string) => {
    const updated = this.state.activeFilters.filters.filter(x => x.id !== id || x.value !== value);
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
    } else if (
      currentFilterType.filterType === FilterTypes.label ||
      currentFilterType.filterType === FilterTypes.nsLabel
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
          aria-label={'filter_input_value'}
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
      )
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
    const path = window.location.pathname;
    const isOverview = path.substr(path.lastIndexOf('/console') + '/console'.length + 1) === 'overview';
    return (
      <Toolbar className="pf-l-toolbar pf-u-justify-content-space-between pf-u-mx-xl pf-u-my-md">
        <ToolbarSection aria-label="ToolbarSection">
          <ToolbarGroup style={{ marginRight: '0px' }}>
            <ToolbarItem className={classNames(this.props.children ? filterWithChildrenStyle : '', 'pf-u-mr-xl')}>
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
          {(this.state.activeFilters.filters.filter(f => f.id === labelFilter.id).length > 0 ||
            this.state.currentFilterType.filterType === FilterTypes.label) && (
            <ToolbarGroup>
              <ToolbarItem className={classNames('pf-u-mr-md')}>
                <span className={classNames(paddingStyle)}>Label Operation</span>
                <FormSelect
                  value={activeFilters.op}
                  onChange={value =>
                    this.updateActiveFilters({ filters: this.state.activeFilters.filters, op: value as LabelOperation })
                  }
                  aria-label="filter_select_value"
                  style={{ width: 'auto' }}
                >
                  <FormSelectOption key={'filter_or'} value={'or'} label={'or'} />
                  <FormSelectOption key={'filter_and'} value={'and'} label={'and'} />
                </FormSelect>
              </ToolbarItem>
            </ToolbarGroup>
          )}
          {this.props.rightToolbar && this.renderRightToolbar()}
        </ToolbarSection>
        {activeFilters && activeFilters.filters.length > 0 && (
          <ToolbarSection aria-label="FiltersSection" style={isOverview ? { marginLeft: '10px' } : {}}>
            <>{'Active Filters:'}</>
            <div style={{ marginLeft: '5px', display: 'inline-flex', height: '80%' }}>
              <ChipGroup defaultIsOpen={true} withToolbar={true}>
                {Object.entries(groupBy(activeFilters.filters, 'id')).map(([category, items]) => {
                  // At least one item is present after groupBy, and all items inside category share the same title
                  const title = items[0].title;
                  return (
                    <ChipGroupToolbarItem key={category} categoryName={title}>
                      {items.map(item => (
                        <Chip
                          key={'filter_' + category + '_' + item.value}
                          onClick={() => this.removeFilter(category, item.value)}
                        >
                          {item.value}
                        </Chip>
                      ))}
                    </ChipGroupToolbarItem>
                  );
                })}
              </ChipGroup>
            </div>
            <Button
              variant="link"
              onClick={e => {
                e.preventDefault();
                this.clearFilters();
              }}
              style={{ marginLeft: '5px' }}
            >
              Clear All Filters
            </Button>
          </ToolbarSection>
        )}
      </Toolbar>
    );
  }
}
