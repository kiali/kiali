import { location, router } from '../../../app/History';
import * as FilterHelper from '../FilterHelper';
import { DEFAULT_LABEL_OPERATION, FilterType } from '../../../types/Filters';

const managedFilterTypes = [
  {
    category: 'A'
  },
  {
    category: 'C'
  },
  {
    category: 'D'
  }
] as FilterType[];

describe('List page', () => {
  it('sets selected filters from URL', () => {
    router.navigate('?a=1&b=2&c=3&c=4');
    const filters = FilterHelper.getFiltersFromURL(managedFilterTypes);
    expect(filters).toEqual({
      filters: [
        {
          category: 'A',
          value: '1'
        },
        {
          category: 'C',
          value: '3'
        },
        {
          category: 'C',
          value: '4'
        }
      ],
      op: 'or'
    });
  });

  it('sets selected filters to URL', () => {
    router.navigate('?a=10&b=20&c=30&c=40');
    const cleanFilters = FilterHelper.setFiltersToURL(managedFilterTypes, {
      filters: [
        {
          category: 'A',
          value: '1'
        },
        {
          category: 'C',
          value: '3'
        },
        {
          category: 'C',
          value: '4'
        }
      ],
      op: DEFAULT_LABEL_OPERATION
    });
    expect(location.getSearch()).toEqual('?b=20&a=1&c=3&c=4&opLabel=or');
    expect(cleanFilters.filters).toHaveLength(3);
  });

  it('sets selected filters to URL with OpLabel to and', () => {
    router.navigate('?a=10&b=20&c=30&c=40');
    const cleanFilters = FilterHelper.setFiltersToURL(managedFilterTypes, {
      filters: [
        {
          category: 'A',
          value: '1'
        },
        {
          category: 'C',
          value: '3'
        },
        {
          category: 'C',
          value: '4'
        }
      ],
      op: 'and'
    });
    expect(location.getSearch()).toEqual('?b=20&a=1&c=3&c=4&opLabel=and');
    expect(cleanFilters.filters).toHaveLength(3);
    expect(cleanFilters.op).toEqual('and');
  });

  it('filters should match URL, ignoring order and non-managed query params', () => {
    router.navigate('?a=1&b=2&c=3&c=4');
    // Make sure order is ignored
    const match = FilterHelper.filtersMatchURL(managedFilterTypes, {
      filters: [
        {
          category: 'C',
          value: '3'
        },
        {
          category: 'A',
          value: '1'
        },
        {
          category: 'C',
          value: '4'
        }
      ],
      op: DEFAULT_LABEL_OPERATION
    });
    expect(match).toBe(true);
  });

  it('filters should not match URL', () => {
    router.navigate('?a=1&b=2&c=3&c=4');
    // Incorrect value
    let match = FilterHelper.filtersMatchURL(managedFilterTypes, {
      filters: [
        {
          category: 'A',
          value: '1'
        },
        {
          category: 'C',
          value: '3'
        },
        {
          category: 'C',
          value: '5'
        }
      ],
      op: DEFAULT_LABEL_OPERATION
    });
    expect(match).toBe(false);

    // Missing value from selection
    match = FilterHelper.filtersMatchURL(managedFilterTypes, {
      filters: [
        {
          category: 'A',
          value: '1'
        },
        {
          category: 'C',
          value: '3'
        }
      ],
      op: DEFAULT_LABEL_OPERATION
    });
    expect(match).toBe(false);

    // Missing value from URL
    match = FilterHelper.filtersMatchURL(managedFilterTypes, {
      filters: [
        {
          category: 'A',
          value: '1'
        },
        {
          category: 'C',
          value: '3'
        },
        {
          category: 'C',
          value: '4'
        },
        {
          category: 'C',
          value: '5'
        }
      ],
      op: DEFAULT_LABEL_OPERATION
    });
    expect(match).toBe(false);

    // Missing key from selection
    match = FilterHelper.filtersMatchURL(managedFilterTypes, {
      filters: [
        {
          category: 'A',
          value: '1'
        }
      ],
      op: DEFAULT_LABEL_OPERATION
    });
    expect(match).toBe(false);

    // Missing key from URL
    match = FilterHelper.filtersMatchURL(managedFilterTypes, {
      filters: [
        {
          category: 'A',
          value: '1'
        },
        {
          category: 'C',
          value: '3'
        },
        {
          category: 'C',
          value: '4'
        },
        {
          category: 'D',
          value: '5'
        }
      ],
      op: DEFAULT_LABEL_OPERATION
    });
    expect(match).toBe(false);
  });
});
