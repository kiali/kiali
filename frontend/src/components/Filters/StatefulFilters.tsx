import * as React from 'react';
import {
  Checkbox,
  TextInput,
  TextInputTypes,
  Toolbar,
  ToolbarGroup,
  ToolbarItem,
  ToolbarContent,
  ToolbarFilter,
  Select,
  SelectList,
  SelectOption,
  MenuToggleElement,
  MenuToggle,
  TextInputGroup,
  TextInputGroupMain,
  ToolbarChipGroup,
  ToolbarChip
} from '@patternfly/react-core';
import {
  ActiveFilter,
  ActiveFiltersInfo,
  DEFAULT_LABEL_OPERATION,
  FILTER_ACTION_UPDATE,
  FilterType,
  AllFilterTypes,
  LabelOperation,
  ToggleType,
  ActiveTogglesInfo
} from '../../types/Filters';
import * as FilterHelper from '../FilterList/FilterHelper';
import { PromisesRegistry } from '../../utils/CancelablePromises';
import { kialiStyle } from 'styles/StyleUtils';
import { LabelFilters } from './LabelFilter';
import { arrayEquals } from 'utils/Common';
import { labelFilter } from './CommonFilters';
import { HistoryManager, location } from 'app/History';
import { serverConfig } from 'config';
import { PFColors } from '../Pf/PfColors';
import { t } from 'utils/I18nUtils';
import { connect } from 'react-redux';
import { KialiAppState } from 'store/Store';
import { languageSelector } from 'store/Selectors';

const toolbarStyle = kialiStyle({
  padding: 0,
  rowGap: 'var(--pf-v5-global--spacer--md)',
  $nest: {
    '& > .pf-v5-c-toolbar__content': {
      paddingLeft: 0
    }
  }
});

const bottomPadding = kialiStyle({
  paddingBottom: 'var(--pf-v5-global--spacer--md)'
});

const formSelectStyle = kialiStyle({
  borderColor: PFColors.BorderColorLight100,
  backgroundColor: PFColors.BackgroundColor200,
  minWidth: '170px',
  maxWidth: '170px'
});

const filterSelectStyle = kialiStyle({
  maxHeight: '350px',
  overflow: 'auto'
});

type ReduxProps = {
  language: string;
};

type StatefulFiltersProps = ReduxProps & {
  children?: React.ReactNode;
  childrenFirst?: boolean;
  initialFilters: FilterType[];
  initialToggles?: ToggleType[];
  onFilterChange: (active: ActiveFiltersInfo) => void;
  onToggleChange?: (active: ActiveTogglesInfo) => void;
  ref?: React.RefObject<StatefulFiltersComponent>;
};

interface StatefulFiltersState {
  activeFilters: ActiveFiltersInfo;
  activeToggles: number;
  currentFilterType: FilterType;
  currentValue: string;
  filterTypes: FilterType[];
  focusedItemIndex: number | null;
  isFilterTypeOpen: boolean;
  isFilterValueOpen: boolean;
}

export class FilterSelected {
  static selectedFilters: ActiveFilter[] | undefined = undefined;
  static opSelected: LabelOperation;

  static init = (filterTypes: FilterType[]): ActiveFiltersInfo => {
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

  static resetFilters = (): void => {
    FilterSelected.selectedFilters = undefined;
  };

  static setSelected = (activeFilters: ActiveFiltersInfo): void => {
    FilterSelected.selectedFilters = activeFilters.filters;
    FilterSelected.opSelected = activeFilters.op;
  };

  static getSelected = (): ActiveFiltersInfo => {
    return { filters: FilterSelected.selectedFilters ?? [], op: FilterSelected.opSelected ?? 'or' };
  };

  static isInitialized = (): boolean => {
    return FilterSelected.selectedFilters !== undefined;
  };
}

// Column toggles
export class Toggles {
  static checked: ActiveTogglesInfo = new Map<string, boolean>();
  static numChecked = 0;

  static init = (toggles: ToggleType[]): number => {
    Toggles.checked.clear();
    Toggles.numChecked = 0;

    // Prefer URL settings
    const urlParams = new URLSearchParams(location.getSearch());

    toggles.forEach(t => {
      const urlIsChecked = HistoryManager.getBooleanParam(`${t.name}Toggle`, urlParams);
      const isChecked = urlIsChecked === undefined ? t.isChecked : urlIsChecked;
      Toggles.checked.set(t.name, isChecked);

      if (isChecked) {
        Toggles.numChecked++;
      }
    });
    return Toggles.numChecked;
  };

  static setToggle = (name: string, value: boolean): number => {
    HistoryManager.setParam(`${name}Toggle`, `${value}`);
    Toggles.checked.set(name, value);
    Toggles.numChecked = value ? Toggles.numChecked++ : Toggles.numChecked--;

    return Toggles.numChecked;
  };

  static getToggles = (): ActiveTogglesInfo => {
    return new Map<string, boolean>(Toggles.checked);
  };
}

const dividerStyle = kialiStyle({
  borderRight: `1px solid ${PFColors.ColorLight300}`,
  padding: '0.5rem',
  display: 'inherit'
});

const paddingStyle = kialiStyle({
  padding: '0 0.5rem 0.5rem 0.5rem',
  width: '100%'
});

export type StatefulFiltersRef = React.RefObject<StatefulFiltersComponent>;

export class StatefulFiltersComponent extends React.Component<StatefulFiltersProps, StatefulFiltersState> {
  private textInputRef: React.RefObject<HTMLDivElement>;
  private promises = new PromisesRegistry();

  constructor(props: StatefulFiltersProps) {
    super(props);

    this.textInputRef = React.createRef<HTMLInputElement>();

    this.state = {
      activeFilters: FilterSelected.init(this.props.initialFilters),
      activeToggles: Toggles.init(this.props.initialToggles ?? []),
      currentFilterType: this.props.initialFilters[0],
      filterTypes: this.props.initialFilters,
      isFilterTypeOpen: false,
      isFilterValueOpen: false,
      currentValue: '',
      focusedItemIndex: null
    };
  }

  componentDidMount(): void {
    this.loadDynamicFilters();
  }

  private loadDynamicFilters = (): void => {
    // Call all loaders from FilterTypes and set results in state
    const filterTypePromises = this.props.initialFilters.map(async ft => {
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
  };

  private getCurrentFilterTypes = (): FilterType => {
    return (
      this.props.initialFilters.find(f => f.category === this.state.currentFilterType.category) ??
      this.props.initialFilters[0]
    );
  };

  componentDidUpdate(prevProps: StatefulFiltersProps, prevState: StatefulFiltersState): void {
    // If the props filters changed (e.g. different values), some state update is necessary
    if (
      this.props.initialFilters !== prevProps.initialFilters &&
      !arrayEquals(this.props.initialFilters, prevProps.initialFilters, (t1, t2) => {
        return (
          t1.category === t2.category &&
          arrayEquals(t1.filterValues, t2.filterValues, (v1, v2) => {
            return v1.id === v2.id && v1.title === v2.title;
          })
        );
      })
    ) {
      const current = this.getCurrentFilterTypes();
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

    // If the input text changes in typeahead, filter the select options according to the input text value
    if (
      this.state.currentFilterType.filterType === AllFilterTypes.typeAhead &&
      this.state.currentValue !== prevState.currentValue
    ) {
      const current = Object.assign({}, this.getCurrentFilterTypes());

      current.filterValues = current.filterValues.filter(menuItem =>
        String(menuItem.title).toLowerCase().includes(this.state.currentValue.toLowerCase())
      );

      this.setState({
        currentFilterType: current,
        isFilterValueOpen: true
      });
    }
  }

  componentWillUnmount(): void {
    this.promises.cancelAll();
  }

  updateActiveFilters = (activeFilters: ActiveFiltersInfo): void => {
    const cleanFilters = FilterHelper.setFiltersToURL(this.state.filterTypes, activeFilters);
    FilterSelected.setSelected(cleanFilters);
    this.setState({ activeFilters: cleanFilters, currentValue: '' });
    this.props.onFilterChange(cleanFilters);
  };

  filterAdded = (field: FilterType, value: string): void => {
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

  selectFilterType = (value: string): void => {
    const { currentFilterType } = this.state;
    const filterType = this.state.filterTypes.filter(filter => filter.category === value)[0];

    if (currentFilterType !== filterType) {
      this.setState({
        currentValue: '',
        currentFilterType: filterType
      });
    }

    this.setState({ isFilterTypeOpen: false });
  };

  filterValueSelected = (valueId?: string | number): void => {
    const { currentFilterType } = this.state;
    const filterValue = currentFilterType.filterValues.find(filter => filter.id === valueId);

    if (filterValue && !this.isActive(currentFilterType, filterValue.title)) {
      this.filterAdded(currentFilterType, filterValue.title);
    }

    setTimeout(() => this.setState({ isFilterValueOpen: false }));
  };

  updateCurrentValue = (value: string): void => {
    this.setState({ currentValue: value, focusedItemIndex: null });
  };

  onValueKeyDown = (keyEvent: React.KeyboardEvent): void => {
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

  onTypeaheadInputKeyDown = (keyEvent: React.KeyboardEvent): void => {
    const { isFilterValueOpen, focusedItemIndex, currentFilterType } = this.state;

    if (keyEvent.key === 'ArrowUp' || keyEvent.key === 'ArrowDown') {
      let indexToFocus: number | null = null;

      if (this.state.isFilterValueOpen) {
        if (keyEvent.key === 'ArrowUp') {
          // When no index is set or at the first index, focus to the last, otherwise decrement focus index
          if (focusedItemIndex === null || focusedItemIndex === 0) {
            indexToFocus = currentFilterType.filterValues.length - 1;
          } else {
            indexToFocus = focusedItemIndex - 1;
          }
        } else if (keyEvent.key === 'ArrowDown') {
          // When no index is set or at the last index, focus to the first, otherwise increment focus index
          if (focusedItemIndex === null || focusedItemIndex === currentFilterType.filterValues.length - 1) {
            indexToFocus = 0;
          } else {
            indexToFocus = focusedItemIndex + 1;
          }
        }

        this.setState({ focusedItemIndex: indexToFocus });
      }
    } else if (keyEvent.key === 'Enter') {
      const focusedItem = focusedItemIndex !== null ? currentFilterType.filterValues[focusedItemIndex] : null;

      if (isFilterValueOpen && focusedItem) {
        this.filterValueSelected(focusedItem.id);
        this.setState({ currentValue: '', focusedItemIndex: null });
      }
    }
  };

  isActive = (type: FilterType, value: string): boolean => {
    return this.state.activeFilters.filters.some(active => value === active.value && type.category === active.category);
  };

  removeFilter = (category: string | ToolbarChipGroup, value: string | ToolbarChip): void => {
    const filterCategory = typeof category === 'string' ? category : category.key;
    const filterValue = typeof value === 'string' ? value : value.key;

    const updated = this.state.activeFilters.filters.filter(
      x => x.category !== filterCategory || x.value !== filterValue
    );

    if (updated.length !== this.state.activeFilters.filters.length) {
      this.updateActiveFilters({ filters: updated, op: this.state.activeFilters.op });
    }
  };

  clearFilters = (): void => {
    this.updateActiveFilters({ filters: [], op: DEFAULT_LABEL_OPERATION });
  };

  onFilterTypeToggle = (): void => {
    this.setState({
      isFilterTypeOpen: !this.state.isFilterTypeOpen
    });
  };

  onFilterValueToggle = (): void => {
    this.setState({
      isFilterValueOpen: !this.state.isFilterValueOpen
    });

    this.textInputRef?.current?.focus();
  };

  onCheckboxChange = (checked: boolean, event: React.FormEvent<HTMLInputElement>): void => {
    this.setState({ activeToggles: Toggles.setToggle(event.currentTarget.name, checked) });
    if (this.props.onToggleChange) {
      this.props.onToggleChange(Toggles.getToggles());
    }
  };

  renderInput = (): React.ReactNode => {
    const { currentFilterType, currentValue } = this.state;

    if (!currentFilterType) {
      return null;
    }

    if (currentFilterType.filterType === AllFilterTypes.typeAhead) {
      const typeaheadToggle = (toggleRef: React.Ref<MenuToggleElement>): React.ReactNode => (
        <MenuToggle
          id="filter_select_value-toggle"
          ref={toggleRef}
          variant="typeahead"
          onClick={this.onFilterValueToggle}
          isExpanded={this.state.isFilterValueOpen}
          isFullWidth
        >
          <TextInputGroup isPlain>
            <TextInputGroupMain
              value={this.state.currentValue}
              onClick={this.onFilterValueToggle}
              onChange={(_event, value) => this.updateCurrentValue(value)}
              id="typeahead-select-input"
              autoComplete="off"
              innerRef={this.textInputRef}
              onKeyDown={this.onTypeaheadInputKeyDown}
              placeholder={t(this.state.currentFilterType.placeholder)}
              role="combobox"
              isExpanded={this.state.isFilterValueOpen}
              aria-controls="select-typeahead-listbox"
            />
          </TextInputGroup>
        </MenuToggle>
      );

      return (
        <Select
          id="filter_select_value"
          selected={this.state.activeFilters.filters.map(filter => filter.value)}
          onSelect={(_event, value) => this.filterValueSelected(value)}
          onOpenChange={isFilterValueOpen => this.setState({ isFilterValueOpen })}
          toggle={typeaheadToggle}
          isOpen={this.state.isFilterValueOpen}
          aria-label="Filter Select Value"
          className={filterSelectStyle}
          shouldFocusFirstItemOnOpen={false}
        >
          <SelectList isAriaMultiselectable data-test="istio-type-dropdown">
            {currentFilterType.filterValues.length > 0 ? (
              currentFilterType.filterValues.map((filter, index) => (
                <SelectOption
                  id={filter.id}
                  key={filter.id}
                  value={filter.id}
                  isFocused={this.state.focusedItemIndex === index}
                  label={t(filter.title)}
                >
                  {t(filter.title)}
                </SelectOption>
              ))
            ) : (
              <SelectOption id="filter_no_results" key="filter_no_results" value="no_results" isDisabled={true}>
                {t('No results found')}
              </SelectOption>
            )}
          </SelectList>
        </Select>
      );
    } else if (currentFilterType.filterType === AllFilterTypes.select) {
      const selectToggle = (toggleRef: React.Ref<MenuToggleElement>): React.ReactNode => (
        <MenuToggle
          id="filter_select_value-toggle"
          ref={toggleRef}
          onClick={this.onFilterValueToggle}
          isExpanded={this.state.isFilterValueOpen}
          isFullWidth
        >
          {t(this.state.currentFilterType.placeholder)}
        </MenuToggle>
      );

      return (
        <Select
          id="filter_select_value"
          selected={FilterSelected.getSelected().filters.map(filter => filter.value)}
          onSelect={(_event, value) => {
            this.filterValueSelected(value);
            this.updateCurrentValue(value as string);
          }}
          onOpenChange={isFilterValueOpen => this.setState({ isFilterValueOpen })}
          toggle={selectToggle}
          isOpen={this.state.isFilterValueOpen}
          aria-label="Filter Select Value"
          className={filterSelectStyle}
        >
          <SelectList>
            {currentFilterType.filterValues.map(filter => (
              <SelectOption id={filter.id} key={filter.id} value={filter.id}>
                {t(filter.title)}
              </SelectOption>
            ))}
          </SelectList>
        </Select>
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
          id="filter_input_value"
          type={currentFilterType.filterType as TextInputTypes}
          value={currentValue}
          aria-label="Filter Input Value"
          placeholder={t(currentFilterType.placeholder)}
          onChange={(_event, value) => this.updateCurrentValue(value)}
          onKeyDown={e => this.onValueKeyDown(e)}
          style={{ width: 'auto' }}
        />
      );
    }
  };

  renderChildren = (): React.ReactNode => {
    return (
      this.props.children && (
        <ToolbarGroup style={{ marginRight: '10px' }}>
          {Array.isArray(this.props.children) ? (
            (this.props.children as Array<any>).map(
              (child, index) =>
                child && (
                  <ToolbarItem
                    key={`toolbar_statefulFilters_${index}`}
                    className={index === (this.props.children as Array<any>).length - 1 ? paddingStyle : dividerStyle}
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

  render(): React.ReactNode {
    const showIncludeToggles = serverConfig.kialiFeatureFlags.uiDefaults.list.showIncludeToggles;

    const { currentFilterType, activeFilters } = this.state;

    const hasActiveFilters =
      this.state.activeFilters.filters.some(f => f.category === labelFilter.category) ||
      this.state.currentFilterType.filterType === AllFilterTypes.label;

    const filterTypeToggle = (toggleRef: React.Ref<MenuToggleElement>): React.ReactNode => (
      <MenuToggle
        id="filter_select_type-toggle"
        className={formSelectStyle}
        ref={toggleRef}
        onClick={this.onFilterTypeToggle}
        isExpanded={this.state.isFilterTypeOpen}
        isFullWidth
      >
        {t(currentFilterType.category)}
      </MenuToggle>
    );

    const filterValueToggle = (toggleRef: React.Ref<MenuToggleElement>): React.ReactNode => (
      <MenuToggle
        id="filter_select_value-toggle"
        ref={toggleRef}
        onClick={this.onFilterValueToggle}
        isExpanded={this.state.isFilterValueOpen}
        isFullWidth
      >
        {t(activeFilters.op)}
      </MenuToggle>
    );

    return (
      <>
        <Toolbar id="filter-selection" className={toolbarStyle} clearAllFilters={this.clearFilters}>
          {this.props.childrenFirst && this.renderChildren()}
          <ToolbarContent>
            <ToolbarGroup variant="filter-group">
              {this.state.filterTypes.map((ft, i) => (
                <ToolbarFilter
                  key={`toolbar_filter-${ft.category}`}
                  chips={activeFilters.filters
                    .filter(af => af.category === ft.category)
                    .map(af => ({
                      key: af.value,
                      node: t(af.value)
                    }))}
                  deleteChip={this.removeFilter}
                  categoryName={{ key: ft.category, name: t(ft.category) }}
                >
                  {i === 0 && (
                    <Select
                      id="filter_select_type"
                      onSelect={(_event, value) => this.selectFilterType(value as string)}
                      onOpenChange={isFilterTypeOpen => this.setState({ isFilterTypeOpen })}
                      toggle={filterTypeToggle}
                      isOpen={this.state.isFilterTypeOpen}
                      aria-label="Filter Select Type"
                    >
                      <SelectList>
                        {this.state.filterTypes.map(option => (
                          <SelectOption
                            id={option.category}
                            key={option.category}
                            value={option.category}
                            isSelected={option.category === currentFilterType.category}
                          >
                            {t(option.category)}
                          </SelectOption>
                        ))}
                      </SelectList>
                    </Select>
                  )}
                  {i === 0 && this.renderInput()}
                </ToolbarFilter>
              ))}
            </ToolbarGroup>

            <ToolbarGroup>
              {showIncludeToggles &&
                this.props.initialToggles &&
                this.props.initialToggles.map((t, i) => (
                  <ToolbarItem key={`toggle-${i}`}>
                    <Checkbox
                      data-test={`toggle-${t.name}`}
                      id={t.name}
                      isChecked={Toggles.checked.get(t.name)}
                      label={t.label}
                      name={t.name}
                      onChange={(event, checked: boolean) => this.onCheckboxChange(checked, event)}
                    />
                  </ToolbarItem>
                ))}
            </ToolbarGroup>

            {!this.props.childrenFirst && this.renderChildren()}

            {hasActiveFilters && (
              <ToolbarGroup>
                <ToolbarItem>
                  <div className={paddingStyle}>Label Operation</div>
                  <Select
                    id="filter_select_value"
                    onSelect={(_event, value) => {
                      this.updateActiveFilters({
                        filters: this.state.activeFilters.filters,
                        op: value as LabelOperation
                      });
                      this.setState({ isFilterValueOpen: false });
                    }}
                    onOpenChange={isFilterValueOpen => this.setState({ isFilterValueOpen })}
                    toggle={filterValueToggle}
                    isOpen={this.state.isFilterValueOpen}
                    aria-label="Filter Select Value"
                  >
                    <SelectList>
                      <SelectOption
                        id={'filter_or'}
                        key={'filter_or'}
                        value={'or'}
                        isSelected={activeFilters.op === 'or'}
                      >
                        {t('or')}
                      </SelectOption>
                      <SelectOption
                        id={'filter_and'}
                        key={'filter_and'}
                        value={'and'}
                        isSelected={activeFilters.op === 'and'}
                      >
                        {t('and')}
                      </SelectOption>
                    </SelectList>
                  </Select>
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

const mapStateToProps = (state: KialiAppState): ReduxProps => ({
  language: languageSelector(state)
});

export const StatefulFilters = connect(mapStateToProps, null, null, { forwardRef: true })(StatefulFiltersComponent);
