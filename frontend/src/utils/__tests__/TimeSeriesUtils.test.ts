import { genSeries } from 'types/__mocks__/Charts.mock';
import { filterAndRenameMetric, LabelsInfo } from 'utils/TimeSeriesUtils';
import { SingleLabelValues } from 'types/Metrics';

describe('TimeSeries Utils', () => {
  it('should rename different metrics with labels', () => {
    const metrics = genSeries([
      { name: 'serie-A', labels: { lbl1: 'v1' } },
      { name: 'serie-B', labels: { lbl1: 'v2' } },
      { name: 'serie-C', labels: { lbl1: 'v3' } }
    ]);
    const labelsInfo: LabelsInfo = { values: new Map([['lbl1', { v1: true, v2: true, v3: true }]]) };
    const processed = filterAndRenameMetric(metrics, labelsInfo);
    expect(processed).toHaveLength(3);
    expect(processed[0].name).toEqual('serie-A [v1]');
    expect(processed[1].name).toEqual('serie-B [v2]');
    expect(processed[2].name).toEqual('serie-C [v3]');
  });

  it('should rename same metric with labels', () => {
    const metrics = genSeries([
      { name: 'serie-A', labels: { lbl1: 'v1' } },
      { name: 'serie-A', labels: { lbl1: 'v2' } },
      { name: 'serie-A', labels: { lbl1: 'v3' } }
    ]);
    const labelsInfo: LabelsInfo = { values: new Map([['lbl1', { v1: true, v2: true, v3: true }]]) };
    const processed = filterAndRenameMetric(metrics, labelsInfo);
    expect(processed).toHaveLength(3);
    expect(processed[0].name).toEqual('v1');
    expect(processed[1].name).toEqual('v2');
    expect(processed[2].name).toEqual('v3');
  });

  it('should filter hidden series', () => {
    const metrics = genSeries([
      { name: 'serie-A', labels: { lbl1: 'v1' } },
      { name: 'serie-A', labels: { lbl1: 'v2' } },
      { name: 'serie-A', labels: { lbl1: 'v3' } }
    ]);
    const labelsInfo: LabelsInfo = { values: new Map([['lbl1', { v1: true, v2: false, v3: true }]]) };
    const processed = filterAndRenameMetric(metrics, labelsInfo);
    expect(processed).toHaveLength(2);
    expect(processed[0].name).toEqual('v1');
    expect(processed[1].name).toEqual('v3');
  });

  it('should rename with multiple labels', () => {
    const metrics = genSeries([
      { name: 'serie-A', labels: { lbl1: 'v1', lbl2: 'foo' } },
      { name: 'serie-A', labels: { lbl1: 'v2', lbl2: 'foo' } },
      { name: 'serie-A', labels: { lbl1: 'v3', lbl2: 'bar' } }
    ]);
    const labelsInfo: LabelsInfo = {
      values: new Map<string, SingleLabelValues>([
        ['lbl1', { v1: true, v2: true, v3: true }],
        ['lbl2', { foo: true, bar: true }]
      ])
    };
    const processed = filterAndRenameMetric(metrics, labelsInfo);
    expect(processed).toHaveLength(3);
    expect(processed[0].name).toEqual('v1,foo');
    expect(processed[1].name).toEqual('v2,foo');
    expect(processed[2].name).toEqual('v3,bar');
  });

  it('should rename hidding single-value labels', () => {
    const metrics = genSeries([
      { name: 'serie-A', labels: { lbl1: 'v1', lbl2: 'foo' } },
      { name: 'serie-A', labels: { lbl1: 'v2', lbl2: 'foo' } },
      { name: 'serie-A', labels: { lbl1: 'v3', lbl2: 'foo' } }
    ]);
    const labelsInfo: LabelsInfo = {
      values: new Map<string, SingleLabelValues>([
        ['lbl1', { v1: true, v2: true, v3: true }],
        ['lbl2', { foo: true }]
      ])
    };
    const processed = filterAndRenameMetric(metrics, labelsInfo);
    expect(processed).toHaveLength(3);
    expect(processed[0].name).toEqual('v1');
    expect(processed[1].name).toEqual('v2');
    expect(processed[2].name).toEqual('v3');
  });
});
