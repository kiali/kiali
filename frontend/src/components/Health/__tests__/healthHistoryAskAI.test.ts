import { buildHealthHistoryChatQuery } from '../healthHistoryAskAI';
import { getHealthHistoryRange } from '../HealthHistoryNavigation';

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
    expect(query).toContain('from');
    expect(query).toContain('to');
    expect(query).toContain('What likely caused this');
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
