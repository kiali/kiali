import { getDataSupplier } from '../victoryChartsUtils';
import { empty, histogram, metric } from '../../types/__mocks__/Charts.mock';

const t0 = new Date('2019-05-02T13:00:00.000Z');
const t1 = new Date('2019-05-02T13:01:00.000Z');
const t2 = new Date('2019-05-02T13:02:00.000Z');

describe('Victory Charts Utils', () => {
  it('should provide empty columns for empty metric', () => {
    const res = getDataSupplier(empty, new Map())!();
    expect(res.legend).toHaveLength(0);
    expect(res.series).toHaveLength(0);
  });

  it('should provide columns for metric', () => {
    const res = getDataSupplier(metric, new Map())!();
    expect(res.legend).toHaveLength(1);
    expect(res.series).toHaveLength(1);
    expect(res.series[0].map(s => s.x)).toEqual([t0, t1, t2]);
    expect(res.series[0].map(s => s.y)).toEqual([50.4, 48.2, 42]);
    expect(res.series[0].map(s => s.name)).toEqual(['Metric chart', 'Metric chart', 'Metric chart']);
  });

  it('should provide columns for histogram', () => {
    const res = getDataSupplier(histogram, new Map())!();
    expect(res.legend).toHaveLength(2);
    expect(res.series).toHaveLength(2);
    expect(res.series[0].map(s => s.x)).toEqual([t0, t1, t2]);
    expect(res.series[0].map(s => s.y)).toEqual([50.4, 48.2, 42]);
    expect(res.series[0].map(s => s.name)).toEqual(['average', 'average', 'average']);
    expect(res.series[1].map(s => s.x)).toEqual([t0, t1, t2]);
    expect(res.series[1].map(s => s.y)).toEqual([150.4, 148.2, 142]);
    expect(res.series[1].map(s => s.name)).toEqual(['quantile 0.99', 'quantile 0.99', 'quantile 0.99']);
  });
});
