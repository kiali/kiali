import { NamespaceInfo } from '../../../types/NamespaceInfo';
import { sortFields, sortFunc } from '../Sorts';

const allNamespaces: NamespaceInfo[] = [
  {
    name: 'alpha',
    validations: {
      namespace: 'alpha',
      objectCount: 0,
      errors: 0,
      warnings: 0
    }
  },
  {
    name: 'beta',
    validations: {
      namespace: 'beta',
      objectCount: 0,
      errors: 0,
      warnings: 0
    }
  },
  {
    name: 'default',
    validations: {
      namespace: 'default',
      objectCount: 2,
      errors: 0,
      warnings: 0
    }
  },
  {
    name: 'electronic-shop',
    validations: {
      namespace: 'electronic-shop',
      objectCount: 2,
      errors: 0,
      warnings: 0
    }
  },
  {
    name: 'fraud-detection',
    validations: {
      namespace: 'fraud-detection',
      objectCount: 0,
      errors: 0,
      warnings: 0
    }
  },
  {
    name: 'istio-system',
    validations: {
      namespace: 'istio-system',
      objectCount: 0,
      errors: 0,
      warnings: 0
    }
  },
  {
    name: 'travel-agency',
    validations: {
      namespace: 'travel-agency',
      objectCount: 0,
      errors: 0,
      warnings: 0
    }
  },
  {
    name: 'travel-control',
    validations: {
      namespace: 'travel-control',
      objectCount: 0,
      errors: 0,
      warnings: 0
    }
  },
  {
    name: 'travel-portal',
    validations: {
      namespace: 'travel-portal',
      objectCount: 0,
      errors: 0,
      warnings: 0
    }
  }
];

const configSortField = sortFields[3];

describe('Overview Page ', () => {
  it('sorts config asc', () => {
    const sortedNamespaces = sortFunc(allNamespaces, configSortField, true);
    expect(sortedNamespaces.map(n => n.name)).toEqual([
      'istio-system',
      'default',
      'electronic-shop',
      'alpha',
      'beta',
      'fraud-detection',
      'travel-agency',
      'travel-control',
      'travel-portal'
    ]);
  });

  it('sorts config desc', () => {
    const sortedNamespaces = sortFunc(allNamespaces, configSortField, false);
    expect(sortedNamespaces.map(n => n.name)).toEqual([
      'istio-system',
      'travel-portal',
      'travel-control',
      'travel-agency',
      'fraud-detection',
      'beta',
      'alpha',
      'electronic-shop',
      'default'
    ]);
  });
});
