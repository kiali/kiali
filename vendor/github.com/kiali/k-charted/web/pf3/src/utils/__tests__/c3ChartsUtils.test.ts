import { getDataSupplier, mergeTimestampsAndNormalize } from '../c3ChartsUtils';
import { empty, histogram, metric } from '../../types/__mocks__/Charts.mock';

describe('C3 Charts Utils', () => {
  it('should provide empty columns for empty metric', () => {
    const res = getDataSupplier(empty, new Map())!();
    expect(res.columns).toHaveLength(2);
    expect(res.columns[0]).toEqual(['x']);
    expect(res.columns[1]).toEqual(['']);
  });

  it('should provide columns for metric', () => {
    const res = getDataSupplier(metric, new Map())!();
    expect(res.columns).toHaveLength(2);
    expect(res.columns[0]).toEqual(['x', 1556802000000, 1556802060000, 1556802120000]);
    expect(res.columns[1]).toEqual(['Metric chart', 50.4, 48.2, 42]);
  });

  it('should provide columns for histogram', () => {
    const res = getDataSupplier(histogram, new Map())!();
    expect(res.columns).toHaveLength(3);
    expect(res.columns[0]).toEqual(['x', 1556802000000, 1556802060000, 1556802120000]);
    expect(res.columns[1]).toEqual(['average', 50.4, 48.2, 42]);
    expect(res.columns[2]).toEqual(['quantile 0.99', 150.4, 148.2, 142]);
  });

  it('should normalize with ealier metric', () => {
    const current = {
      x: [15000, 20000, 25000, 30000],
      ys: [
        {
          name: 'a',
          values: [5, 6, 6, 5]
        },
        {
          name: 'b',
          values: [9, 7, 7, 9]
        }
      ]
    };
    const newTimestamps = [10001, 15001, 20001, 25001, 30001];
    const newValues = {
      name: 'c',
      values: [3, 2, 3, 2, 3]
    };
    const normalized = mergeTimestampsAndNormalize(current, newTimestamps, newValues);

    expect(normalized.x).toEqual([10001, 15000, 20000, 25000, 30000]);
    expect(normalized.ys).toHaveLength(3);
    expect(normalized.ys[0].name).toEqual('a');
    expect(normalized.ys[1].name).toEqual('b');
    expect(normalized.ys[2].name).toEqual('c');
    expect(normalized.ys[0].values).toEqual([NaN, 5, 6, 6, 5]);
    expect(normalized.ys[1].values).toEqual([NaN, 9, 7, 7, 9]);
    expect(normalized.ys[2].values).toEqual([3, 2, 3, 2, 3]);
  });

  it('should normalize with later metric', () => {
    const current = {
      x: [15000, 20000, 25000, 30000],
      ys: [
        {
          name: 'a',
          values: [5, 6, 6, 5]
        },
        {
          name: 'b',
          values: [9, 7, 7, 9]
        }
      ]
    };
    const newTimestamps = [20001, 25001, 30001];
    const newValues = {
      name: 'c',
      values: [3, 2, 3]
    };
    const normalized = mergeTimestampsAndNormalize(current, newTimestamps, newValues);

    expect(normalized.x).toEqual([15000, 20000, 25000, 30000]);
    expect(normalized.ys).toHaveLength(3);
    expect(normalized.ys[0].name).toEqual('a');
    expect(normalized.ys[1].name).toEqual('b');
    expect(normalized.ys[2].name).toEqual('c');
    expect(normalized.ys[0].values).toEqual([5, 6, 6, 5]);
    expect(normalized.ys[1].values).toEqual([9, 7, 7, 9]);
    expect(normalized.ys[2].values).toEqual([NaN, 3, 2, 3]);
  });
});
