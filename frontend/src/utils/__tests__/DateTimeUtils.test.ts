import { i18n } from 'i18n';
import {
  addDaysFromNowIso,
  diffMs,
  format12HourClockTime,
  formatFrom,
  formatFromNow,
  formatNotificationTimestamp,
  formatRelativeDate,
  formatUtcDateTime,
  isSameOrBefore
} from '../DateTimeUtils';

describe('DateTimeUtils', () => {
  it('formats UTC datetime with milliseconds', () => {
    const time = Date.UTC(2024, 0, 15, 10, 5, 6, 7);
    expect(formatUtcDateTime(time)).toBe('2024-01-15 10:05:06.007');
  });

  it('returns empty string for invalid UTC datetime input', () => {
    expect(formatUtcDateTime(Number.NaN)).toBe('');
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

  it('formatRelativeDate returns empty string for invalid input', () => {
    expect(formatRelativeDate(Number.NaN)).toBe('');
  });

  it('format12HourClockTime uses locale twelve-hour time', () => {
    const afternoon = new Date(2024, 5, 1, 13, 4, 5);
    expect(format12HourClockTime(afternoon)).toMatch(/1:04:05/);
    expect(format12HourClockTime(afternoon)).toMatch(/pm/i);
    const midnight = new Date(2024, 5, 1, 0, 4, 5);
    expect(format12HourClockTime(midnight)).toMatch(/12:04:05/);
    expect(format12HourClockTime(midnight)).toMatch(/am/i);
  });

  it('formatFromNow uses stable relative buckets', () => {
    const now = new Date('2024-06-01T12:00:00Z');
    const fiveMinAgo = new Date('2024-06-01T11:55:00Z');
    expect(formatFromNow(fiveMinAgo, now)).toMatch(/minute/i);
    const twoHoursAgo = new Date('2024-06-01T10:00:00Z');
    expect(formatFromNow(twoHoursAgo, now)).toMatch(/hour/i);
  });

  it('formatFrom mirrors moment().from for notification count windows', () => {
    const now = new Date('2024-06-01T12:00:00Z');
    const fiveMinAgo = new Date('2024-06-01T11:55:00Z');
    expect(formatFrom(fiveMinAgo, now)).toMatch(/^in /i);
    expect(formatFrom(fiveMinAgo, now)).toMatch(/minute/i);
    expect(formatFromNow(fiveMinAgo, now)).toMatch(/\d+ minutes? ago$/i);
  });

  it('formatRelativeDate uses month label for other years', () => {
    const date = new Date('2020-03-15T12:00:00Z');
    expect(formatRelativeDate(date)).toMatch(/Mar/);
    expect(formatRelativeDate(date, true)).toMatch(/March/);
  });

  it('formatNotificationTimestamp stays relative under 60 minutes', () => {
    const now = new Date('2024-06-01T12:00:00Z');
    const fiftyNineMinAgo = new Date('2024-06-01T11:01:00Z');
    expect(formatNotificationTimestamp(fiftyNineMinAgo, now)).toMatch(/minute/i);
  });

  it('formatNotificationTimestamp switches to locale datetime at 60 minutes', () => {
    const now = new Date('2024-06-01T12:00:00Z');
    const sixtyMinAgo = new Date('2024-06-01T11:00:00Z');
    const locale = i18n.resolvedLanguage ?? i18n.language ?? 'en';
    expect(formatNotificationTimestamp(sixtyMinAgo, now)).toBe(sixtyMinAgo.toLocaleString(locale));
  });
});
