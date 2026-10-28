import { buildHealthHistoryChatContext, buildHealthHistoryChatQuery } from '../healthHistoryAskAI';
import {
  formatHealthHistoryChatRangeTo,
  formatHealthHistoryChatTimestamp,
  getHealthHistoryRange
} from '../HealthHistoryNavigation';

const identityT = (key: string, options?: Record<string, unknown>): string => {
  if (!options) {
    return key;
  }

  return Object.entries(options).reduce((text, [name, value]) => text.replaceAll(`{{${name}}}`, String(value)), key);
};

describe('buildHealthHistoryChatQuery', () => {
  const timestamp = Date.UTC(2026, 9, 15, 12, 0, 23) / 1000;
  const now = Date.UTC(2026, 9, 15, 13);
  const range = getHealthHistoryRange(timestamp, 600, now);

  it('builds a query for the selected investigation range', () => {
    const query = buildHealthHistoryChatQuery(
      identityT,
      'service',
      'reviews',
      'bookinfo',
      'Degraded',
      range,
      timestamp * 1000
    );

    expect(query).toContain('Degraded');
    expect(query).toContain('reviews');
    expect(query).toContain('bookinfo');
    expect(query).toContain(formatHealthHistoryChatTimestamp(range.from));
    expect(query).toContain(formatHealthHistoryChatRangeTo(range.to));
    expect(query).toContain('The health history shows status');
    expect(query).toContain('What likely caused this');
    expect(query).not.toContain('MCP tools');
  });

  it('uses a shorter prompt when the selected status is healthy', () => {
    const query = buildHealthHistoryChatQuery(
      identityT,
      'workload',
      'waypoint',
      'bookinfo',
      'Healthy',
      range,
      timestamp * 1000
    );

    expect(query).toContain(formatHealthHistoryChatTimestamp(range.from));
    expect(query).toContain(formatHealthHistoryChatRangeTo(range.to));
    expect(query).toContain(
      'Investigate whether any notable events, changes, or anomalies occurred during this period.'
    );
    expect(query).not.toContain('What likely caused this');
    expect(query).not.toContain('MCP tools');
  });

  it('describes a namespace resource without repeating the namespace label', () => {
    const query = buildHealthHistoryChatQuery(
      identityT,
      'namespace',
      'bookinfo',
      'bookinfo',
      'Healthy',
      range,
      timestamp * 1000
    );

    expect(query).toContain("namespace 'bookinfo'");
    expect(query).not.toContain("in namespace 'bookinfo'");
  });
});

describe('buildHealthHistoryChatContext', () => {
  const timestamp = Date.UTC(2026, 9, 15, 12, 0, 23) / 1000;
  const now = Date.UTC(2026, 9, 15, 13);
  const range = getHealthHistoryRange(timestamp, 600, now);

  it('includes investigation metadata and MCP tool hints for services', () => {
    const context = buildHealthHistoryChatContext(identityT, 'service', 'reviews', 'bookinfo', 'Degraded', range);

    expect(context).toContain('Health history investigation');
    expect(context).toContain('reviews');
    expect(context).toContain(formatHealthHistoryChatTimestamp(range.from));
    expect(context).toContain('get_metrics (resourceType service');
    expect(context).toContain('list_traces (serviceName');
  });

  it('includes workload-specific log guidance when status is healthy', () => {
    const context = buildHealthHistoryChatContext(identityT, 'workload', 'waypoint', 'bookinfo', 'Healthy', range);

    expect(context).toContain('get_logs (name must be this workload name');
    expect(context).not.toContain('What likely caused this');
  });
});
