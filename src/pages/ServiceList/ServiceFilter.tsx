import * as React from 'react';
import { Filter, FormControl, Toolbar } from 'patternfly-react';

type ServiceFilterValue = {
  id: string;
  title: string;
};

type ServiceFilterType = {
  id: string;
  title: string;
  placeholder: string;
  filterType: string;
  filterValues: ServiceFilterValue[];
};

type ServiceFilterProps = {};

type ActiveFilterType = {
  label: string;
};

type ServiceFilterState = {
  currentFilterType: ServiceFilterType;
  activeFilters: ActiveFilterType[];
  currentValue: string;
};

const demoFilters: ServiceFilterType[] = [
  {
    id: 'servicename',
    title: 'Service Name',
    placeholder: 'Filter by Service Name',
    filterType: 'text',
    filterValues: []
  },
  {
    id: 'namespace',
    title: 'Namespace',
    placeholder: 'Filter by Namespace',
    filterType: 'select',
    filterValues: [
      { title: 'istio-system', id: 'istio-system' },
      { title: 'kubernetes', id: 'kubernetes' },
      { title: 'default', id: 'default' },
      { title: 'myproject', id: 'myproject' }
    ]
  }
];

class ServiceFilter extends React.Component<ServiceFilterProps, ServiceFilterState> {
  constructor(props: ServiceFilterProps) {
    super(props);

    this.updateCurrentValue = this.updateCurrentValue.bind(this);
    this.onValueKeyPress = this.onValueKeyPress.bind(this);
    this.selectFilterType = this.selectFilterType.bind(this);
    this.filterValueSelected = this.filterValueSelected.bind(this);
    this.removeFilter = this.removeFilter.bind(this);
    this.clearFilters = this.clearFilters.bind(this);

    this.state = {
      currentFilterType: demoFilters[0],
      activeFilters: [],
      currentValue: ''
    };
  }

  filterAdded(field: any, value: any) {
    let filterText = '';
    if (field.title) {
      filterText = field.title;
    }
    filterText += ': ';

    if (value.filterCategory) {
      filterText +=
        (value.filterCategory.title || value.filterCategory) + '-' + (value.filterValue.title || value.filterValue);
    } else if (value.title) {
      filterText += value.title;
    } else {
      filterText += value;
    }

    let activeFilters = this.state.activeFilters;
    activeFilters.push({ label: filterText });
    this.setState({ activeFilters: activeFilters });
  }

  selectFilterType(filterType: ServiceFilterType) {
    const { currentFilterType } = this.state;
    if (currentFilterType !== filterType) {
      this.setState({
        currentValue: '',
        currentFilterType: filterType
      });
    }
  }

  filterValueSelected(filterValue: ServiceFilterValue) {
    const { currentFilterType, currentValue } = this.state;

    if (filterValue && filterValue.id !== currentValue) {
      this.filterAdded(currentFilterType, filterValue);
    }
  }

  updateCurrentValue(event: any) {
    this.setState({ currentValue: event.target.value });
  }

  onValueKeyPress(keyEvent: any) {
    const { currentValue, currentFilterType } = this.state;

    if (keyEvent.key === 'Enter' && currentValue && currentValue.length > 0) {
      this.setState({ currentValue: '' });
      this.filterAdded(currentFilterType, currentValue);
      keyEvent.stopPropagation();
      keyEvent.preventDefault();
    }
  }

  removeFilter(filter: ActiveFilterType) {
    const { activeFilters } = this.state;

    let index = activeFilters.indexOf(filter);
    if (index > -1) {
      let updated = [...activeFilters.slice(0, index), ...activeFilters.slice(index + 1)];
      this.setState({ activeFilters: updated });
    }
  }

  clearFilters() {
    this.setState({ activeFilters: [] });
  }

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
        <div style={{ width: 300 }}>
          <Filter>
            <Filter.TypeSelector
              filterTypes={demoFilters}
              currentFilterType={currentFilterType}
              onFilterTypeSelected={this.selectFilterType}
            />
            {this.renderInput()}
          </Filter>
        </div>
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
      </div>
    );
  }
}

export default ServiceFilter;
