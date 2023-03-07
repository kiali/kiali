import { removeDuplicatesArray, groupBy } from '../Common';

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
