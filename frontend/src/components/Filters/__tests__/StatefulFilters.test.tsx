import * as React from 'react';
import { mount } from 'enzyme';
import { StatefulFiltersComponent } from '../StatefulFilters';
import { istioSidecarFilter, labelFilter } from '../CommonFilters';
import { ActiveFilter, DEFAULT_LABEL_OPERATION } from '../../../types/Filters';
import { i18n } from 'i18n';

const labelValue = 'app:details';
const filterActive: ActiveFilter = { category: labelFilter.category, value: labelValue };

describe('StatefulFilters', () => {
  it('add filter', () => {
    const stFilter = new StatefulFiltersComponent({
      initialFilters: [],
      onFilterChange: () => {},
      t: (key: string) => key,
      tReady: true,
      i18n: i18n
    });

    stFilter.filterAdded(labelFilter, labelValue);
    expect(stFilter.state.activeFilters).toStrictEqual({ filters: [filterActive], op: DEFAULT_LABEL_OPERATION });
  });

  it('remove Filter', () => {
    const labelVersion = 'version:v1';
    const wrapper = mount(
      <StatefulFiltersComponent
        onFilterChange={jest.fn()}
        initialFilters={[labelFilter, istioSidecarFilter]}
        t={(key: string) => key}
        tReady={true}
        i18n={i18n}
      />
    ).instance() as StatefulFiltersComponent;

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
