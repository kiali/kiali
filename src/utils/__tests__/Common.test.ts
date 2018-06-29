import { removeDuplicatesArray } from '../Common';

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
