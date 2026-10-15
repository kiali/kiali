// Assisted-by: OpenAI Codex
import { getHealthHistoryGraphUrl, getHealthHistoryRange } from '../HealthHistoryNavigation';
import type { HealthHistoryType } from 'services/Api';

describe('health history navigation', () => {
  const clicked = Date.UTC(2026, 9, 15, 12, 0, 23) / 1000;
  const now = Date.UTC(2026, 9, 15, 13);

  it('centers a ten-minute window and aligns it to the replay minute boundary', () => {
    expect(getHealthHistoryRange(clicked, 600, now)).toEqual({
      from: Date.UTC(2026, 9, 15, 11, 55),
      to: Date.UTC(2026, 9, 15, 12, 5)
    });
  });

  it('shifts a near-now window backwards while preserving its length', () => {
    const range = getHealthHistoryRange(now / 1000 - 30, 600, now);
    expect(range.to).toBe(now);
    expect(range.to - range.from).toBe(600000);
  });

  it('adjusts the window around the same historical click', () => {
    const range = getHealthHistoryRange(clicked, 1800, now);
    expect(range).toEqual({ from: Date.UTC(2026, 9, 15, 11, 45), to: Date.UTC(2026, 9, 15, 12, 15) });
  });

  it.each([
    ['app', '/graph/node/namespaces/bookinfo/applications/reviews', 'app'],
    ['workload', '/graph/node/namespaces/bookinfo/workloads/reviews', 'workload'],
    ['service', '/graph/node/namespaces/bookinfo/services/reviews', 'service'],
    ['namespace', '/graph/namespaces', 'workload']
  ])('opens %s replay with matching resource, cluster, and fixed bounds', (type, path, graphType) => {
    const range = getHealthHistoryRange(clicked, 600, now);
    const url = new URL(
      getHealthHistoryGraphUrl(type as HealthHistoryType, 'bookinfo', 'reviews', 'east', range, 60),
      'http://kiali'
    );
    expect(url.pathname).toBe(path);
    expect(Object.fromEntries(url.searchParams)).toMatchObject({
      namespaces: 'bookinfo',
      clusterName: 'east',
      graphType,
      replayActive: 'true',
      replayStart: String(range.from),
      replayInterval: '600000',
      duration: '60'
    });
    expect(url.searchParams.has('from')).toBe(false);
    expect(url.searchParams.has('to')).toBe(false);
  });

  it('encodes application names and cluster names without injecting URL parameters', () => {
    const url = new URL(
      getHealthHistoryGraphUrl(
        'app',
        'bookinfo',
        'reviews/v1?foo=bar',
        'east&replayActive=false',
        getHealthHistoryRange(clicked, 60, now),
        60
      ),
      'http://kiali'
    );
    expect(url.pathname).toBe('/graph/node/namespaces/bookinfo/applications/reviews%2Fv1%3Ffoo%3Dbar');
    expect(url.searchParams.get('clusterName')).toBe('east&replayActive=false');
    expect(url.searchParams.get('replayActive')).toBe('true');
  });
});
