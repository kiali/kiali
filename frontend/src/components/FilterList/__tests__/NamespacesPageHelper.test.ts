import * as FilterHelper from '../FilterHelper';
import { NamespaceInfo } from '../../../types/NamespaceInfo';
import * as Filters from '../../../pages/Namespaces/Filters';
import { FilterSelected } from '../../Filters/StatefulFilters';

const allNamespaces: NamespaceInfo[] = [
  {
    name: 'a',
    worstStatus: 'Degraded',
    statusApp: {
      inNotReady: [],
      inError: [],
      inWarning: ['a-tres'],
      inSuccess: ['a-uno', 'a-dos'],
      notAvailable: []
    }
  },
  {
    name: 'b',
    worstStatus: 'Failure',
    statusApp: {
      inNotReady: [],
      inError: ['b-tres'],
      inWarning: ['b-dos'],
      inSuccess: ['b-uno'],
      notAvailable: []
    }
  },
  {
    name: 'c',
    worstStatus: 'Healthy',
    statusApp: {
      inNotReady: [],
      inError: [],
      inWarning: [],
      inSuccess: ['c-uno', 'c-dos', 'c-tres'],
      notAvailable: []
    }
  }
];

describe('Namespaces Page', () => {
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

    expect(filteredNamespaces.length).toEqual(1);
    expect(filteredNamespaces[0].name).toEqual('a');
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
