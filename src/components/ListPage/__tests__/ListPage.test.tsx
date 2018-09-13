import { ListPage } from '../ListPage';
import { FilterSelected } from '../../Filters/StatefulFilters';
import { Location } from 'history';
import { FilterType } from '../../../types/Filters';
import { createBrowserHistory } from 'history';

const history = createBrowserHistory({ basename: '' });
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
    const mock: any = jest.fn();
    const listPage = new ListPage.Component({
      match: mock,
      location: {
        search: '?a=1&b=2&c=3&c=4'
      } as Location,
      history: history,
      staticContext: mock
    });
    listPage.setSelectedFiltersFromURL(managedFilterTypes);
    expect(FilterSelected.getSelected()).toEqual([
      {
        category: 'A',
        label: 'A: 1',
        value: '1'
      },
      {
        category: 'C',
        label: 'C: 3',
        value: '3'
      },
      {
        category: 'C',
        label: 'C: 4',
        value: '4'
      }
    ]);
  });

  it('sets selected filters to URL', () => {
    const mock: any = jest.fn();
    const listPage = new ListPage.Component({
      match: mock,
      location: {
        pathname: 'any',
        search: '?a=10&b=20&c=30&c=40'
      } as Location,
      history: history,
      staticContext: mock
    });
    FilterSelected.setSelected([
      {
        category: 'A',
        label: 'A: 1',
        value: '1'
      },
      {
        category: 'C',
        label: 'C: 3',
        value: '3'
      },
      {
        category: 'C',
        label: 'C: 4',
        value: '4'
      }
    ]);
    listPage.setSelectedFiltersToURL(managedFilterTypes);
    expect(listPage.props.history.location.search).toEqual('?b=20&a=1&c=3&c=4');
  });

  it('filters should match URL, ignoring order and non-managed query params', () => {
    const mock: any = jest.fn();
    const listPage = new ListPage.Component({
      match: mock,
      location: {
        search: '?a=1&b=2&c=3&c=4'
      } as Location,
      history: history,
      staticContext: mock
    });
    // Make sure order is ignored
    FilterSelected.setSelected([
      {
        category: 'C',
        label: 'C: 3',
        value: '3'
      },
      {
        category: 'A',
        label: 'A: 1',
        value: '1'
      },
      {
        category: 'C',
        label: 'C: 4',
        value: '4'
      }
    ]);
    const match = listPage.filtersMatchURL(managedFilterTypes);
    expect(match).toBe(true);
  });

  it('filters should not match URL', () => {
    const mock: any = jest.fn();
    const listPage = new ListPage.Component({
      match: mock,
      location: {
        search: '?a=1&b=2&c=3&c=4'
      } as Location,
      history: history,
      staticContext: mock
    });
    // Incorrect value
    FilterSelected.setSelected([
      {
        category: 'A',
        label: 'A: 1',
        value: '1'
      },
      {
        category: 'C',
        label: 'C: 3',
        value: '3'
      },
      {
        category: 'C',
        label: 'C: 5',
        value: '5'
      }
    ]);
    let match = listPage.filtersMatchURL(managedFilterTypes);
    expect(match).toBe(false);

    // Missing value from selection
    FilterSelected.setSelected([
      {
        category: 'A',
        label: 'A: 1',
        value: '1'
      },
      {
        category: 'C',
        label: 'C: 3',
        value: '3'
      }
    ]);
    match = listPage.filtersMatchURL(managedFilterTypes);
    expect(match).toBe(false);

    // Missing value from URL
    FilterSelected.setSelected([
      {
        category: 'A',
        label: 'A: 1',
        value: '1'
      },
      {
        category: 'C',
        label: 'C: 3',
        value: '3'
      },
      {
        category: 'C',
        label: 'C: 4',
        value: '4'
      },
      {
        category: 'C',
        label: 'C: 5',
        value: '5'
      }
    ]);
    match = listPage.filtersMatchURL(managedFilterTypes);
    expect(match).toBe(false);

    // Missing key from selection
    FilterSelected.setSelected([
      {
        category: 'A',
        label: 'A: 1',
        value: '1'
      }
    ]);
    match = listPage.filtersMatchURL(managedFilterTypes);
    expect(match).toBe(false);

    // Missing key from URL
    FilterSelected.setSelected([
      {
        category: 'A',
        label: 'A: 1',
        value: '1'
      },
      {
        category: 'C',
        label: 'C: 3',
        value: '3'
      },
      {
        category: 'C',
        label: 'C: 4',
        value: '4'
      },
      {
        category: 'D',
        label: 'D: 5',
        value: '5'
      }
    ]);
    match = listPage.filtersMatchURL(managedFilterTypes);
    expect(match).toBe(false);
  });
});
