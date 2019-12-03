import { getDataSupplier } from '../victoryChartsUtils';
import { empty, histogram, metric, metricWithLabels, emptyLabels, labelsWithPrettifier } from '../../types/__mocks__/Charts.mock';
import { ChartModel } from '../..';

const t0 = new Date('2019-05-02T13:00:00.000Z');
const t1 = new Date('2019-05-02T13:01:00.000Z');
const t2 = new Date('2019-05-02T13:02:00.000Z');

const colors = ['red', 'green', 'blue'];

describe('Victory Charts Utils', () => {
  it('should provide empty columns for empty metric', () => {
    const res = getDataSupplier(empty, emptyLabels, colors)!();
    expect(res).toHaveLength(0);
  });

  it('should provide columns for metric', () => {
    const res = getDataSupplier(metric, emptyLabels, colors)!();
    expect(res).toHaveLength(1);
    expect(res[0].datapoints.map(s => s.x)).toEqual([t0, t1, t2]);
    expect(res[0].datapoints.map(s => s.y)).toEqual([50.4, 48.2, 42]);
    expect(res[0].datapoints.map(s => s.name)).toEqual(['Metric chart', 'Metric chart', 'Metric chart']);
  });

  it('should provide columns for histogram', () => {
    const res = getDataSupplier(histogram, emptyLabels, colors)!();
    expect(res).toHaveLength(2);
    expect(res[0].datapoints.map(s => s.x)).toEqual([t0, t1, t2]);
    expect(res[0].datapoints.map(s => s.y)).toEqual([50.4, 48.2, 42]);
    expect(res[0].datapoints.map(s => s.name)).toEqual(['avg', 'avg', 'avg']);
    expect(res[1].datapoints.map(s => s.x)).toEqual([t0, t1, t2]);
    expect(res[1].datapoints.map(s => s.y)).toEqual([150.4, 148.2, 142]);
    expect(res[1].datapoints.map(s => s.name)).toEqual(['p99', 'p99', 'p99']);
  });

  it('should ignore NaN values', () => {
    const withNaN: ChartModel = {
      name: '',
      unit: '',
      spans: 6,
      metric: [{
        values: [[1, 1], [2, 2], [3, NaN], [4, 4]],
        labelSet: {}
      }]
    };

    const res = getDataSupplier(withNaN, emptyLabels, colors)!();
    expect(res).toHaveLength(1);
    expect(res[0].datapoints.map(s => s.y)).toEqual([1, 2, 4]);
  });

  it('should prettify labels', () => {
    const res = getDataSupplier(metricWithLabels, labelsWithPrettifier, colors)!();
    expect(res).toHaveLength(3);
    expect(res.map(s => s.legendItem.name)).toEqual(['OK', 'No content', 'foobar']);
    expect(res[0].datapoints.map(s => s.name)).toEqual(['OK']);
    expect(res[1].datapoints.map(s => s.name)).toEqual(['No content']);
    expect(res[2].datapoints.map(s => s.name)).toEqual(['foobar']);
  });
});
