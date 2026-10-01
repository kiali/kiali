import type { Datapoint } from 'types/Metrics';
import { buildHealthStatusSegments, findHealthStatusSegmentAt } from '../HealthStatusRibbonUtils';

describe('buildHealthStatusSegments', () => {
  it('returns a single n/a segment when there are no datapoints', () => {
    const segments = buildHealthStatusSegments([], 100, 200);

    expect(segments).toHaveLength(1);
    expect(segments[0]).toMatchObject({
      startTime: 100,
      endTime: 200,
      status: -1,
      label: 'n/a'
    });
  });

  it('merges consecutive datapoints with the same status', () => {
    const datapoints: Datapoint[] = [
      [100, 0],
      [110, 0],
      [120, 0]
    ];

    const segments = buildHealthStatusSegments(datapoints, 100, 200);

    expect(segments).toHaveLength(1);
    expect(segments[0]).toMatchObject({ startTime: 100, endTime: 200, status: 0, label: 'Healthy' });
  });

  it('creates separate segments when status changes', () => {
    const datapoints: Datapoint[] = [
      [100, 0],
      [150, 2],
      [200, 0]
    ];

    const segments = buildHealthStatusSegments(datapoints, 100, 250);

    expect(segments).toHaveLength(3);
    expect(segments[0]).toMatchObject({ startTime: 100, endTime: 150, status: 0, label: 'Healthy' });
    expect(segments[1]).toMatchObject({ startTime: 150, endTime: 200, status: 2, label: 'Degraded' });
    expect(segments[2]).toMatchObject({ startTime: 200, endTime: 250, status: 0, label: 'Healthy' });
  });

  it('fills a leading gap with an n/a segment', () => {
    const datapoints: Datapoint[] = [[150, 0]];

    const segments = buildHealthStatusSegments(datapoints, 100, 200);

    expect(segments).toHaveLength(2);
    expect(segments[0]).toMatchObject({ startTime: 100, endTime: 150, status: -1, label: 'n/a' });
    expect(segments[1]).toMatchObject({ startTime: 150, endTime: 200, status: 0, label: 'Healthy' });
  });

  it('treats unknown status values as n/a', () => {
    const segments = buildHealthStatusSegments([[100, 99]], 100, 200);

    expect(segments).toHaveLength(1);
    expect(segments[0]).toMatchObject({ startTime: 100, endTime: 200, status: 99, label: 'n/a' });
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
      200
    );

    expect(findHealthStatusSegmentAt(segments, 125)).toMatchObject({ status: 0, label: 'Healthy' });
    expect(findHealthStatusSegmentAt(segments, 175)).toMatchObject({ status: 2, label: 'Degraded' });
  });
});
