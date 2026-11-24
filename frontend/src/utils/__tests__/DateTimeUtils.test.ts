import {
  addDaysFromNowIso,
  diffMs,
  format12HourClockTime,
  formatFromNow,
  formatLocalDateTime,
  formatRelativeDate,
  formatUtcDateTime,
  isSameOrBefore
} from '../DateTimeUtils';

describe('DateTimeUtils', () => {
  it('formats UTC datetime with milliseconds', () => {
    const time = Date.UTC(2024, 0, 15, 10, 5, 6, 7);
    expect(formatUtcDateTime(time)).toBe('2024-01-15 10:05:06.007');
  });

  it('formats local datetime from ISO input', () => {
    const iso = '2024-06-01T12:30:45.123Z';
    const expected = formatLocalDateTime(iso);
    expect(expected).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}\.\d{3}$/);
  });

  it('adds days to now for session expiry', () => {
    const now = Date.now();
    const iso = addDaysFromNowIso(1);
    const diff = new Date(iso).getTime() - now;
    expect(diff).toBeGreaterThan(23 * 60 * 60 * 1000);
    expect(diff).toBeLessThan(25 * 60 * 60 * 1000);
  });

  it('diffMs matches expiry minus now', () => {
    const now = new Date('2024-06-01T12:00:00Z');
    const future = new Date('2024-06-01T12:01:00Z');
    expect(diffMs(future, now)).toBe(60_000);
    const past = new Date('2024-06-01T11:59:00Z');
    expect(diffMs(past, now)).toBe(-60_000);
  });

  it('isSameOrBefore compares instants', () => {
    const a = new Date('2024-06-01T12:00:00Z');
    const b = new Date('2024-06-01T12:00:00Z');
    const later = new Date('2024-06-01T12:01:00Z');
    expect(isSameOrBefore(a, b)).toBe(true);
    expect(isSameOrBefore(later, a)).toBe(false);
  });

  it('formatRelativeDate labels today and yesterday', () => {
    const now = new Date();
    expect(formatRelativeDate(now)).toBe('Today');
    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    expect(formatRelativeDate(yesterday)).toBe('Yesterday');
  });

  it('format12HourClockTime uses twelve-hour clock with am/pm spacing', () => {
    const d = new Date(2024, 5, 1, 13, 4, 5);
    expect(format12HourClockTime(d)).toBe('1:04:05 pm');
    expect(format12HourClockTime(new Date(2024, 5, 1, 0, 4, 5))).toBe('12:04:05 am');
    expect(format12HourClockTime(new Date(2024, 5, 1, 12, 4, 5))).toBe('12:04:05 pm');
  });

  it('formatFromNow uses stable relative buckets', () => {
    const now = new Date('2024-06-01T12:00:00Z');
    const fiveMinAgo = new Date('2024-06-01T11:55:00Z');
    expect(formatFromNow(fiveMinAgo, now)).toMatch(/minute/i);
    const twoHoursAgo = new Date('2024-06-01T10:00:00Z');
    expect(formatFromNow(twoHoursAgo, now)).toMatch(/hour/i);
  });

  it('formatRelativeDate uses month label for other years', () => {
    const date = new Date('2020-03-15T12:00:00Z');
    expect(formatRelativeDate(date)).toMatch(/Mar/);
    expect(formatRelativeDate(date, true)).toMatch(/March/);
  });
});
