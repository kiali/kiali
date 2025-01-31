import { removeDuplicatesArray, groupBy, namespacesForCluster } from '../Common';
import { Namespace } from '../../types/Namespace';

const arrayDuplicates = ['bookinfo', 'default', 'bookinfo'];
const arrayNoDuplicates = ['bookinfo', 'default'];

describe('Unique elements in Array', () => {
  it('should clean duplicates', () => {
    expect(removeDuplicatesArray(arrayDuplicates)).toEqual(['bookinfo', 'default']);
    expect(removeDuplicatesArray(arrayDuplicates).length).toEqual(2);
  });

  it('should return the same array', () => {
    expect(removeDuplicatesArray(arrayNoDuplicates)).toEqual(arrayNoDuplicates);
    expect(removeDuplicatesArray(arrayNoDuplicates).length).toEqual(arrayNoDuplicates.length);
  });
});

describe('Active namespaces per cluster', () => {
  test('should return an empty array when activeNss is empty', () => {
    const activeNss: Namespace[] = [];
    const allNss: Namespace[] = [
      { name: 'namespace1', cluster: 'east' },
      { name: 'namespace2', cluster: 'west' }
    ];
    const cluster = 'east';

    const result = namespacesForCluster(activeNss, allNss, cluster);
    expect(result).toEqual([]);
  });

  test('should return matching namespaces by cluster', () => {
    const activeNss: Namespace[] = [{ name: 'namespace1' }, { name: 'namespace2' }, { name: 'namespace4' }];
    const allNss: Namespace[] = [
      { name: 'namespace1', cluster: 'east' },
      { name: 'namespace2', cluster: 'west' },
      { name: 'namespace3', cluster: 'east' },
      { name: 'namespace4', cluster: 'east' }
    ];
    const cluster = 'east';

    const result = namespacesForCluster(activeNss, allNss, cluster);
    expect(result).toEqual(['namespace1', 'namespace4']);
  });

  test('should return an empty array if no namespaces match the cluster', () => {
    const activeNss: Namespace[] = [{ name: 'namespace1' }, { name: 'namespace2' }];
    const allNss: Namespace[] = [
      { name: 'namespace1', cluster: 'west' },
      { name: 'namespace2', cluster: 'west' }
    ];
    const cluster = 'east';

    const result = namespacesForCluster(activeNss, allNss, cluster);
    expect(result).toEqual([]);
  });

  test('should handle namespaces with missing cluster properties', () => {
    const activeNss: Namespace[] = [{ name: 'namespace1' }, { name: 'namespace2' }];
    const allNss: Namespace[] = [
      { name: 'namespace1', cluster: undefined },
      { name: 'namespace2', cluster: undefined },
      { name: 'namespace3', cluster: undefined }
    ];
    const cluster = 'east';

    const result = namespacesForCluster(activeNss, allNss, cluster);
    expect(result).toEqual([]);
  });

  test('should return matching namespaces when labels are present', () => {
    const activeNss: Namespace[] = [{ name: 'namespace1' }, { name: 'namespace2' }];
    const allNss: Namespace[] = [
      { name: 'namespace1', cluster: 'east', annotations: { key: 'value' }, labels: { key: 'value' } },
      { name: 'namespace2', cluster: 'west', annotations: { key: 'value2' }, labels: { key: 'value2' } }
    ];
    const cluster = 'east';

    const result = namespacesForCluster(activeNss, allNss, cluster);
    expect(result).toEqual(['namespace1']);
  });
});

describe('Group by', () => {
  const arr = [
    {
      id: '1',
      value: 'foo'
    },
    {
      id: '2',
      value: 'bar'
    },
    {
      id: '3',
      value: 'foo'
    }
  ];

  it('should group by id', () => {
    const grouped = groupBy(arr, 'id');
    expect(grouped['1']).toHaveLength(1);
    expect(grouped['1'][0]).toEqual(arr[0]);
    expect(grouped['2']).toHaveLength(1);
    expect(grouped['2'][0]).toEqual(arr[1]);
    expect(grouped['3']).toHaveLength(1);
    expect(grouped['3'][0]).toEqual(arr[2]);
  });

  it('should group by value', () => {
    const grouped = groupBy(arr, 'value');
    expect(grouped['foo']).toHaveLength(2);
    expect(grouped['foo'][0]).toEqual(arr[0]);
    expect(grouped['foo'][1]).toEqual(arr[2]);
    expect(grouped['bar']).toHaveLength(1);
    expect(grouped['bar'][0]).toEqual(arr[1]);
  });
});
