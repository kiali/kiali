import * as React from 'react';
import { act, render } from '@testing-library/react';
import { StatefulFiltersComponent } from '../StatefulFilters';
import { istioSidecarFilter, labelFilter } from '../CommonFilters';
import { ActiveFilter, DEFAULT_LABEL_OPERATION } from '../../../types/Filters';

const labelValue = 'app:details';
const filterActive: ActiveFilter = { category: labelFilter.category, value: labelValue };

describe('StatefulFilters', () => {
  it('add filter', () => {
    const stFilter = new StatefulFiltersComponent({
      initialFilters: [],
      onFilterChange: () => {},
      language: 'en'
    });

    stFilter.filterAdded(labelFilter, labelValue);
    expect(stFilter.state.activeFilters).toStrictEqual({ filters: [filterActive], op: DEFAULT_LABEL_OPERATION });
  });

  it('remove Filter', () => {
    const labelVersion = 'version:v1';
    const ref = React.createRef<StatefulFiltersComponent>();

    render(
      <StatefulFiltersComponent
        ref={ref}
        onFilterChange={jest.fn()}
        initialFilters={[labelFilter, istioSidecarFilter]}
        language="en"
      />
    );
    const inst = ref.current as StatefulFiltersComponent;

    act(() => {
      inst.filterAdded(labelFilter, labelValue);
      inst.filterAdded(labelFilter, labelVersion);
      inst.filterAdded(istioSidecarFilter, istioSidecarFilter.filterValues[0].id);
    });

    expect(inst.state.activeFilters.filters.length).toEqual(3);

    act(() => {
      inst.removeFilter(labelFilter.category, labelValue);
    });

    expect(inst.state.activeFilters.filters.length).toEqual(2);
    expect(inst.state.activeFilters).toStrictEqual({
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
