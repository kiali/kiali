import * as FilterHelper from '../FilterHelper';
import { NamespaceInfo } from '../../../types/NamespaceInfo';
import * as Filters from '../../../pages/Overview/Filters';
import { FilterSelected } from '../../Filters/StatefulFilters';

const allNamespaces: NamespaceInfo[] = [
  {
    name: 'a',
    status: {
      inNotReady: [],
      inError: [],
      inWarning: ['a-tres'],
      inSuccess: ['a-uno', 'a-dos'],
      notAvailable: []
    }
  },
  {
    name: 'b',
    status: {
      inNotReady: [],
      inError: ['b-tres'],
      inWarning: ['b-dos'],
      inSuccess: ['b-uno'],
      notAvailable: []
    }
  },
  {
    name: 'c',
    status: {
      inNotReady: [],
      inError: [],
      inWarning: [],
      inSuccess: ['c-uno', 'c-dos', 'c-tres'],
      notAvailable: []
    }
  }
];

describe('Overview Page', () => {
  it('filters Healthy namespaces', () => {
    FilterSelected.setSelected({
      filters: [
        {
          category: 'Health',
          value: 'Healthy'
        }
      ],
      op: 'or'
    });
    const filteredNamespaces = FilterHelper.runFilters(
      allNamespaces,
      Filters.availableFilters,
      FilterSelected.getSelected()
    );

    expect(filteredNamespaces.length).toEqual(1);
    expect(filteredNamespaces[0].name).toEqual('c');
  });

  it('filters Warning namespaces', () => {
    FilterSelected.setSelected({
      filters: [
        {
          category: 'Health',
          value: 'Degraded'
        }
      ],
      op: 'or'
    });

    const filteredNamespaces = FilterHelper.runFilters(
      allNamespaces,
      Filters.availableFilters,
      FilterSelected.getSelected()
    );

    expect(filteredNamespaces.length).toEqual(2);
    expect(filteredNamespaces[0].name).toEqual('a');
    expect(filteredNamespaces[1].name).toEqual('b');
  });

  it('filters Failure namespaces', () => {
    FilterSelected.setSelected({
      filters: [
        {
          category: 'Health',
          value: 'Failure'
        }
      ],
      op: 'or'
    });

    const filteredNamespaces = FilterHelper.runFilters(
      allNamespaces,
      Filters.availableFilters,
      FilterSelected.getSelected()
    );

    expect(filteredNamespaces.length).toEqual(1);
    expect(filteredNamespaces[0].name).toEqual('b');
  });
});
