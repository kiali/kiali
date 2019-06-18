import history from '../../../app/History';
import * as ListPagesHelper from '../ListPagesHelper';
import { FilterType } from '../../../types/Filters';

const managedFilterTypes = [
  {
    id: 'a',
    title: 'A'
  },
  {
    id: 'c',
    title: 'C'
  },
  {
    id: 'd',
    title: 'D'
  }
] as FilterType[];

describe('List page', () => {
  it('sets selected filters from URL', () => {
    history.push('?a=1&b=2&c=3&c=4');
    const filters = ListPagesHelper.getFiltersFromURL(managedFilterTypes);
    expect(filters).toEqual([
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
    ]);
  });

  it('sets selected filters to URL', () => {
    history.push('?a=10&b=20&c=30&c=40');
    const cleanFilters = ListPagesHelper.setFiltersToURL(managedFilterTypes, [
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
    ]);
    expect(history.location.search).toEqual('?b=20&a=1&c=3&c=4');
    expect(cleanFilters).toHaveLength(3);
  });

  it('filters should match URL, ignoring order and non-managed query params', () => {
    history.push('?a=1&b=2&c=3&c=4');
    // Make sure order is ignored
    const match = ListPagesHelper.filtersMatchURL(managedFilterTypes, [
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
    ]);
    expect(match).toBe(true);
  });

  it('filters should not match URL', () => {
    history.push('?a=1&b=2&c=3&c=4');
    // Incorrect value
    let match = ListPagesHelper.filtersMatchURL(managedFilterTypes, [
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
    ]);
    expect(match).toBe(false);

    // Missing value from selection
    match = ListPagesHelper.filtersMatchURL(managedFilterTypes, [
      {
        category: 'A',
        value: '1'
      },
      {
        category: 'C',
        value: '3'
      }
    ]);
    expect(match).toBe(false);

    // Missing value from URL
    match = ListPagesHelper.filtersMatchURL(managedFilterTypes, [
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
    ]);
    expect(match).toBe(false);

    // Missing key from selection
    match = ListPagesHelper.filtersMatchURL(managedFilterTypes, [
      {
        category: 'A',
        value: '1'
      }
    ]);
    expect(match).toBe(false);

    // Missing key from URL
    match = ListPagesHelper.filtersMatchURL(managedFilterTypes, [
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
    ]);
    expect(match).toBe(false);
  });
});
