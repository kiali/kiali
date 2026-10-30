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
  const selectedTimeMs = Date.UTC(2026, 9, 15, 12, 0, 0);
  const durationLabel = '10 minutes';

  it('builds a single prompt from selected time, status, and duration', () => {
    const query = buildHealthHistoryChatQuery(
      identityT,
      'service',
      'reviews',
      'Degraded',
      selectedTimeMs,
      durationLabel
    );

    expect(query).toContain("The 'reviews' service");
    expect(query).toContain("'Degraded'");
    expect(query).toContain(formatHealthHistoryChatTimestamp(selectedTimeMs));
    expect(query).toContain('surrounding 10 minutes');
    expect(query).toContain('notable events, changes, or anomalies');
    expect(query).not.toContain('What likely caused this');
    expect(query).not.toContain('MCP tools');
  });

  it('uses the same prompt template when the selected status is healthy', () => {
    const query = buildHealthHistoryChatQuery(
      identityT,
      'workload',
      'waypoint',
      'Healthy',
      selectedTimeMs,
      durationLabel
    );

    expect(query).toContain("The 'waypoint' workload");
    expect(query).toContain("'Healthy'");
    expect(query).toContain(formatHealthHistoryChatTimestamp(selectedTimeMs));
    expect(query).toContain('surrounding 10 minutes');
    expect(query).not.toContain('MCP tools');
  });

  it('describes a namespace resource by name and kind', () => {
    const query = buildHealthHistoryChatQuery(
      identityT,
      'namespace',
      'bookinfo',
      'Healthy',
      selectedTimeMs,
      '30 minutes'
    );

    expect(query).toContain("The 'bookinfo' namespace");
    expect(query).toContain('surrounding 30 minutes');
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
    expect(context).toContain(formatHealthHistoryChatRangeTo(range.to));
    expect(context).toContain('get_metrics (resourceType service');
    expect(context).toContain('list_traces (serviceName');
  });

  it('includes workload-specific log guidance when status is healthy', () => {
    const context = buildHealthHistoryChatContext(identityT, 'workload', 'waypoint', 'bookinfo', 'Healthy', range);

    expect(context).toContain('get_logs (name must be this workload name');
    expect(context).not.toContain('What likely caused this');
  });
});
