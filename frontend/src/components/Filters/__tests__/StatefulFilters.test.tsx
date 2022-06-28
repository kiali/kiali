import * as React from 'react';
import { mount } from 'enzyme';
import { StatefulFilters } from '../StatefulFilters';
import { istioSidecarFilter, labelFilter } from '../CommonFilters';
import { ActiveFilter, DEFAULT_LABEL_OPERATION } from '../../../types/Filters';

const labelValue = 'app:details';
const filterActive: ActiveFilter = { category: labelFilter.category, value: labelValue };

describe('StatefulFilters', () => {
  it('add filter', () => {
    const stFilter = new StatefulFilters({ initialFilters: [], onFilterChange: () => {} });

    stFilter.filterAdded(labelFilter, labelValue);
    expect(stFilter.state.activeFilters).toStrictEqual({ filters: [filterActive], op: DEFAULT_LABEL_OPERATION });
  });

  it('remove Filter', () => {
    const labelVersion = 'version:v1';
    const wrapper = mount(
      <StatefulFilters onFilterChange={jest.fn()} initialFilters={[labelFilter, istioSidecarFilter]} />
    ).instance() as StatefulFilters;

    // Add filters
    wrapper.filterAdded(labelFilter, labelValue);
    wrapper.filterAdded(labelFilter, labelVersion);
    wrapper.filterAdded(istioSidecarFilter, istioSidecarFilter.filterValues[0].id);
    wrapper.forceUpdate();
    expect(wrapper.state.activeFilters.filters.length).toEqual(3);

    // Remove one
    wrapper.removeFilter(labelFilter.category, labelValue);
    wrapper.forceUpdate();
    expect(wrapper.state.activeFilters.filters.length).toEqual(2);
    expect(wrapper.state.activeFilters).toStrictEqual({
      filters: [
        {
          category: labelFilter.category,
          value: labelVersion
        },
        {
          category: istioSidecarFilter.category,
          value: istioSidecarFilter.filterValues[0].id
        }
      ],
      op: DEFAULT_LABEL_OPERATION
    });
  });
});
