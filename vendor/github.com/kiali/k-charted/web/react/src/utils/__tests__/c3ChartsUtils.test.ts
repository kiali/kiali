import { getDataSupplier } from '../c3ChartsUtils';
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
});
