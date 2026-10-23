import { formatLastDuration, formatTrafficStatusLastDuration, parseDurationLabelCount, t } from '../I18nUtils';

rstest.mock('i18n', () => ({
  i18n: {
    isInitialized: true,
    t: (key: string, options?: { count?: number; duration?: string; ns?: string }) => {
      if (key === 'Last {{duration}}') {
        return `Last ${options?.duration} (count=${options?.count})`;
      }

      if (key === 'Traffic Status (Last {{duration}})') {
        return `Traffic Status (Last ${options?.duration}) (count=${options?.count})`;
      }

      return key;
    }
  }
}));

describe('I18nUtils duration helpers', () => {
  it('parseDurationLabelCount extracts leading digits', () => {
    expect(parseDurationLabelCount('5m')).toBe(5);
    expect(parseDurationLabelCount('1h')).toBe(1);
    expect(parseDurationLabelCount('  5m  ')).toBe(5);
  });

  it('parseDurationLabelCount defaults to 2 for invalid labels', () => {
    expect(parseDurationLabelCount('')).toBe(2);
    expect(parseDurationLabelCount('abc')).toBe(2);
  });

  it('formatLastDuration passes count for pluralization', () => {
    expect(formatLastDuration('1m')).toBe('Last 1m (count=1)');
    expect(formatLastDuration('5m')).toBe('Last 5m (count=5)');
  });

  it('formatTrafficStatusLastDuration passes count for pluralization', () => {
    expect(formatTrafficStatusLastDuration('1m')).toBe('Traffic Status (Last 1m) (count=1)');
    expect(formatTrafficStatusLastDuration('5m')).toBe('Traffic Status (Last 5m) (count=5)');
  });

  it('t returns key when i18n is not initialized', () => {
    const original = require('i18n').i18n.isInitialized;
    require('i18n').i18n.isInitialized = false;
    expect(t('Hello')).toBe('Hello');
    require('i18n').i18n.isInitialized = original;
  });
});
