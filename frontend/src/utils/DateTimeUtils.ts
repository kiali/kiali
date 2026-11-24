import { i18n } from 'i18n';
import { t } from 'utils/I18nUtils';

const pad2 = (n: number): string => String(n).padStart(2, '0');
const pad3 = (n: number): string => String(n).padStart(3, '0');

const relativeTimeFormatters = new Map<string, Intl.RelativeTimeFormat>();

/** Active Kiali UI locale for Intl date/time formatting. */
export const getDateLocale = (): string => i18n.resolvedLanguage ?? i18n.language ?? 'en';

const getRelativeTimeFormatter = (): Intl.RelativeTimeFormat => {
  const locale = getDateLocale();
  let formatter = relativeTimeFormatters.get(locale);
  if (!formatter) {
    formatter = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });
    relativeTimeFormatters.set(locale, formatter);
  }
  return formatter;
};

/** UTC `YYYY-MM-DD HH:mm:ss.SSS` (pod logs / span timestamps). */
export const formatUtcDateTime = (timeMs: number): string => {
  const d = new Date(timeMs);
  return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())} ${pad2(d.getUTCHours())}:${pad2(d.getUTCMinutes())}:${pad2(d.getUTCSeconds())}.${pad3(d.getUTCMilliseconds())}`;
};

/** Local `YYYY-MM-DD HH:mm:ss.SSS` from a parseable timestamp string. */
export const formatLocalDateTime = (timestamp: string): string => {
  const d = new Date(timestamp);
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())} ${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}.${pad3(d.getMilliseconds())}`;
};

export const formatLocaleDateTime = (date: Date): string => date.toLocaleString(getDateLocale());

export const addDaysFromNowIso = (days: number): string => {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString();
};

/** Milliseconds from `from` until `expiresOn` (positive when `expiresOn` is in the future). */
export const diffMs = (expiresOn: string | Date, from: Date = new Date()): number => {
  return new Date(expiresOn).getTime() - from.getTime();
};

export const isSameOrBefore = (a: Date, b: Date): boolean => a.getTime() <= b.getTime();

export const formatFromNow = (date: Date, now: Date = new Date()): string => {
  const diffSec = Math.round((date.getTime() - now.getTime()) / 1000);
  const formatter = getRelativeTimeFormatter();
  const absSec = Math.abs(diffSec);

  if (absSec < 60) {
    return formatter.format(diffSec, 'second');
  }
  const diffMin = Math.round(diffSec / 60);
  if (Math.abs(diffMin) < 60) {
    return formatter.format(diffMin, 'minute');
  }
  const diffHour = Math.round(diffSec / 3600);
  if (Math.abs(diffHour) < 24) {
    return formatter.format(diffHour, 'hour');
  }
  const diffDay = Math.round(diffSec / 86400);
  if (Math.abs(diffDay) < 30) {
    return formatter.format(diffDay, 'day');
  }
  const diffMonth = Math.round(diffSec / (86400 * 30));
  if (Math.abs(diffMonth) < 12) {
    return formatter.format(diffMonth, 'month');
  }
  const diffYear = Math.round(diffSec / (86400 * 365));
  return formatter.format(diffYear, 'year');
};

/** Locale-aware 12-hour clock for trace list headers. */
export const format12HourClockTime = (date: Date): string => {
  return date.toLocaleTimeString(getDateLocale(), {
    hour: 'numeric',
    hour12: true,
    minute: '2-digit',
    second: '2-digit'
  });
};

export const formatRelativeDate = (value: number | Date, fullMonthName = false): string => {
  const m = value instanceof Date ? value : new Date(value);
  const dt = new Date();
  const locale = getDateLocale();
  const month: Intl.DateTimeFormatOptions['month'] = fullMonthName ? 'long' : 'short';

  if (dt.getFullYear() !== m.getFullYear()) {
    return m.toLocaleDateString(locale, { day: 'numeric', month, year: 'numeric' });
  }
  if (m.getMonth() === dt.getMonth() && m.getDate() === dt.getDate()) {
    return t('Today');
  }
  const yesterday = new Date(dt);
  yesterday.setDate(dt.getDate() - 1);
  if (m.getMonth() === yesterday.getMonth() && m.getDate() === yesterday.getDate()) {
    return t('Yesterday');
  }
  return m.toLocaleDateString(locale, { day: 'numeric', month });
};
