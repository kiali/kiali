import type { Datapoint } from 'types/Metrics';
import {
  alignPrometheusRange,
  buildHealthStatusSegments,
  findHealthStatusSegmentAt,
  formatAxisTimeLabel
} from '../HealthStatusRibbonUtils';

const defaultStep = 100;

describe('alignPrometheusRange', () => {
  it('aligns start to the Prometheus step boundary', () => {
    const { endTime, startTime } = alignPrometheusRange(1000, 600, 216);

    expect(endTime).toBe(1000);
    expect(startTime).toBe(216);
  });
});

describe('buildHealthStatusSegments', () => {
  it('returns a single n/a segment when there are no datapoints', () => {
    const segments = buildHealthStatusSegments([], 100, 200, defaultStep);

    expect(segments).toHaveLength(1);
    expect(segments[0]).toMatchObject({
      startTime: 100,
      endTime: 200,
      status: -1,
      label: 'NA'
    });
  });

  it('merges consecutive buckets with the same status', () => {
    const datapoints: Datapoint[] = [
      [100, 0],
      [200, 0]
    ];

    const segments = buildHealthStatusSegments(datapoints, 100, 300, defaultStep);

    expect(segments).toHaveLength(1);
    expect(segments[0]).toMatchObject({ startTime: 100, endTime: 300, status: 0, label: 'Healthy' });
  });

  it('creates separate segments when status changes', () => {
    const datapoints: Datapoint[] = [
      [100, 0],
      [200, 2],
      [300, 0]
    ];

    const segments = buildHealthStatusSegments(datapoints, 100, 400, defaultStep);

    expect(segments).toHaveLength(3);
    expect(segments[0]).toMatchObject({ startTime: 100, endTime: 200, status: 0, label: 'Healthy' });
    expect(segments[1]).toMatchObject({ startTime: 200, endTime: 300, status: 2, label: 'Degraded' });
    expect(segments[2]).toMatchObject({ startTime: 300, endTime: 400, status: 0, label: 'Healthy' });
  });

  it('fills a leading gap with an n/a segment', () => {
    const datapoints: Datapoint[] = [[200, 0]];

    const segments = buildHealthStatusSegments(datapoints, 100, 400, defaultStep);

    expect(segments).toHaveLength(3);
    expect(segments[0]).toMatchObject({ startTime: 100, endTime: 200, status: -1, label: 'NA' });
    expect(segments[1]).toMatchObject({ startTime: 200, endTime: 300, status: 0, label: 'Healthy' });
    expect(segments[2]).toMatchObject({ startTime: 300, endTime: 400, status: -1, label: 'NA' });
  });

  it('treats unknown status values as n/a', () => {
    const segments = buildHealthStatusSegments([[100, 99]], 100, 200, defaultStep);

    expect(segments).toHaveLength(1);
    expect(segments[0]).toMatchObject({ startTime: 100, endTime: 200, status: -1, label: 'NA' });
  });

  it('renders n/a for buckets without Prometheus samples', () => {
    const segments = buildHealthStatusSegments([[100, 0]], 100, 500, 100);

    expect(segments).toHaveLength(2);
    expect(segments[0]).toMatchObject({ startTime: 100, endTime: 200, status: 0, label: 'Healthy' });
    expect(segments[1]).toMatchObject({ startTime: 200, endTime: 500, status: -1, label: 'NA' });
  });

  it('renders n/a between samples that are farther apart than one step', () => {
    const segments = buildHealthStatusSegments(
      [
        [100, 0],
        [400, 0]
      ],
      100,
      500,
      100
    );

    expect(segments).toHaveLength(3);
    expect(segments[0]).toMatchObject({ startTime: 100, endTime: 200, status: 0, label: 'Healthy' });
    expect(segments[1]).toMatchObject({ startTime: 200, endTime: 400, status: -1, label: 'NA' });
    expect(segments[2]).toMatchObject({ startTime: 400, endTime: 500, status: 0, label: 'Healthy' });
  });

  it('shows n/a for the first half of a long range when history only exists in the second half', () => {
    const startTime = 0;
    const endTime = 600;
    const step = 100;
    const datapoints: Datapoint[] = [
      [300, 0],
      [400, 0],
      [500, 0]
    ];

    const segments = buildHealthStatusSegments(datapoints, startTime, endTime, step);

    expect(segments[0]).toMatchObject({ startTime: 0, endTime: 300, status: -1, label: 'NA' });
    expect(segments[1]).toMatchObject({ startTime: 300, endTime: 600, status: 0, label: 'Healthy' });
  });
});

describe('findHealthStatusSegmentAt', () => {
  it('returns the segment containing the timestamp', () => {
    const segments = buildHealthStatusSegments(
      [
        [100, 0],
        [200, 2]
      ],
      100,
      300,
      defaultStep
    );

    expect(findHealthStatusSegmentAt(segments, 150)).toMatchObject({ status: 0, label: 'Healthy' });
    expect(findHealthStatusSegmentAt(segments, 250)).toMatchObject({ status: 2, label: 'Degraded' });
  });
});

describe('formatAxisTimeLabel', () => {
  const today = new Date(2026, 9, 5, 12, 0, 0);
  const oneDaySeconds = 86400;
  const sevenDaySeconds = 604800;

  it('shows time only for ranges up to one day', () => {
    const ts = Math.floor(new Date(2026, 9, 5, 14, 30).getTime() / 1000);
    const label = formatAxisTimeLabel(ts, oneDaySeconds, today);

    expect(label).toMatch(/14:30|2:30/);
    expect(label).not.toMatch(/Oct|10/);
  });

  it('shows date for ranges longer than one day', () => {
    const ts = Math.floor(new Date(2026, 9, 1, 14, 30).getTime() / 1000);
    const label = formatAxisTimeLabel(ts, sevenDaySeconds, today);

    expect(label).toMatch(/Oct/);
    expect(label).toMatch(/1/);
    expect(label).not.toMatch(/:/);
  });

  it('includes year when the label is outside the current year', () => {
    const ts = Math.floor(new Date(2025, 11, 28, 14, 30).getTime() / 1000);
    const label = formatAxisTimeLabel(ts, sevenDaySeconds, today);

    expect(label).toMatch(/2025/);
  });
});
