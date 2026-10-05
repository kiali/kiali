import type { Datapoint } from 'types/Metrics';
import { buildHealthStatusSegments, findHealthStatusSegmentAt, formatAxisTimeLabel } from '../HealthStatusRibbonUtils';

const defaultStep = 100;

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

  it('merges consecutive datapoints with the same status', () => {
    const datapoints: Datapoint[] = [
      [100, 0],
      [110, 0],
      [120, 0]
    ];

    const segments = buildHealthStatusSegments(datapoints, 100, 200, defaultStep);

    expect(segments).toHaveLength(1);
    expect(segments[0]).toMatchObject({ startTime: 100, endTime: 200, status: 0, label: 'Healthy' });
  });

  it('creates separate segments when status changes', () => {
    const datapoints: Datapoint[] = [
      [100, 0],
      [150, 2],
      [200, 0]
    ];

    const segments = buildHealthStatusSegments(datapoints, 100, 250, defaultStep);

    expect(segments).toHaveLength(3);
    expect(segments[0]).toMatchObject({ startTime: 100, endTime: 150, status: 0, label: 'Healthy' });
    expect(segments[1]).toMatchObject({ startTime: 150, endTime: 200, status: 2, label: 'Degraded' });
    expect(segments[2]).toMatchObject({ startTime: 200, endTime: 250, status: 0, label: 'Healthy' });
  });

  it('fills a leading gap with an n/a segment', () => {
    const datapoints: Datapoint[] = [[150, 0]];

    const segments = buildHealthStatusSegments(datapoints, 100, 200, 30);

    expect(segments).toHaveLength(3);
    expect(segments[0]).toMatchObject({ startTime: 100, endTime: 150, status: -1, label: 'NA' });
    expect(segments[1]).toMatchObject({ startTime: 150, endTime: 180, status: 0, label: 'Healthy' });
    expect(segments[2]).toMatchObject({ startTime: 180, endTime: 200, status: -1, label: 'NA' });
  });

  it('treats unknown status values as n/a', () => {
    const segments = buildHealthStatusSegments([[100, 99]], 100, 200, defaultStep);

    expect(segments).toHaveLength(1);
    expect(segments[0]).toMatchObject({ startTime: 100, endTime: 200, status: 99, label: 'NA' });
  });

  it('bounds each sample to the query step and renders stale gaps as n/a', () => {
    const segments = buildHealthStatusSegments([[100, 0]], 100, 500, 30);

    expect(segments).toHaveLength(2);
    expect(segments[0]).toMatchObject({ startTime: 100, endTime: 130, status: 0, label: 'Healthy' });
    expect(segments[1]).toMatchObject({ startTime: 130, endTime: 500, status: -1, label: 'NA' });
  });

  it('renders n/a between samples that are farther apart than the step', () => {
    const segments = buildHealthStatusSegments(
      [
        [100, 0],
        [400, 0]
      ],
      100,
      500,
      30
    );

    expect(segments).toHaveLength(4);
    expect(segments[0]).toMatchObject({ startTime: 100, endTime: 130, status: 0, label: 'Healthy' });
    expect(segments[1]).toMatchObject({ startTime: 130, endTime: 400, status: -1, label: 'NA' });
    expect(segments[2]).toMatchObject({ startTime: 400, endTime: 430, status: 0, label: 'Healthy' });
    expect(segments[3]).toMatchObject({ startTime: 430, endTime: 500, status: -1, label: 'NA' });
  });
});

describe('findHealthStatusSegmentAt', () => {
  it('returns the segment containing the timestamp', () => {
    const segments = buildHealthStatusSegments(
      [
        [100, 0],
        [150, 2]
      ],
      100,
      200,
      defaultStep
    );

    expect(findHealthStatusSegmentAt(segments, 125)).toMatchObject({ status: 0, label: 'Healthy' });
    expect(findHealthStatusSegmentAt(segments, 175)).toMatchObject({ status: 2, label: 'Degraded' });
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
