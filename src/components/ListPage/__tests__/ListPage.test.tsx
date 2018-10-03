import { ListPage } from '../ListPage';
import { Location } from 'history';
import { FilterType } from '../../../types/Filters';
import { createBrowserHistory } from 'history';
import { ServiceListFilters } from '../../../pages/ServiceList/FiltersAndSorts';

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

type DemoListState = {};
type DemoListProps = {};
type DemoListItem = {};

class DemoListPage extends ListPage.Component<DemoListProps, DemoListState, DemoListItem> {
  sortFields() {
    return ServiceListFilters.sortFields;
  }
}

describe('List page', () => {
  it('sets selected filters from URL', () => {
    const mock: any = jest.fn();
    const listPage = new DemoListPage({
      match: mock,
      location: {
        search: '?a=1&b=2&c=3&c=4'
      } as Location,
      history: history,
      staticContext: mock
    });
    const filters = listPage.getFiltersFromURL(managedFilterTypes);
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
    const mock: any = jest.fn();
    const listPage = new DemoListPage({
      match: mock,
      location: {
        pathname: 'any',
        search: '?a=10&b=20&c=30&c=40'
      } as Location,
      history: history,
      staticContext: mock
    });
    const cleanFilters = listPage.setFiltersToURL(managedFilterTypes, [
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
    expect(listPage.props.history.location.search).toEqual('?b=20&a=1&c=3&c=4');
    expect(cleanFilters).toHaveLength(3);
  });

  it('filters should match URL, ignoring order and non-managed query params', () => {
    const mock: any = jest.fn();
    const listPage = new DemoListPage({
      match: mock,
      location: {
        search: '?a=1&b=2&c=3&c=4'
      } as Location,
      history: history,
      staticContext: mock
    });
    // Make sure order is ignored
    const match = listPage.filtersMatchURL(managedFilterTypes, [
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
    const mock: any = jest.fn();
    const listPage = new DemoListPage({
      match: mock,
      location: {
        search: '?a=1&b=2&c=3&c=4'
      } as Location,
      history: history,
      staticContext: mock
    });
    // Incorrect value
    let match = listPage.filtersMatchURL(managedFilterTypes, [
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
    match = listPage.filtersMatchURL(managedFilterTypes, [
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
    match = listPage.filtersMatchURL(managedFilterTypes, [
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
    match = listPage.filtersMatchURL(managedFilterTypes, [
      {
        category: 'A',
        value: '1'
      }
    ]);
    expect(match).toBe(false);

    // Missing key from URL
    match = listPage.filtersMatchURL(managedFilterTypes, [
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
