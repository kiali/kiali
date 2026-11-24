const TODAY = 'Today';
const YESTERDAY = 'Yesterday';

const pad2 = (n: number): string => String(n).padStart(2, '0');
const pad3 = (n: number): string => String(n).padStart(3, '0');

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

export const addDaysFromNowIso = (days: number): string => {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString();
};

/** Milliseconds from `from` until `expiresOn` (same sign as moment(expiresOn).diff(from)). */
export const diffMs = (expiresOn: string | Date, from: Date = new Date()): number => {
  return new Date(expiresOn).getTime() - from.getTime();
};

export const isSameOrBefore = (a: Date, b: Date): boolean => a.getTime() <= b.getTime();

/** English relative strings to match legacy moment default (not browser locale). */
const EN_LOCALE = 'en-US';

const relativeTimeFormatter = new Intl.RelativeTimeFormat(EN_LOCALE, { numeric: 'auto' });

export const formatFromNow = (date: Date, now: Date = new Date()): string => {
  const diffSec = Math.round((date.getTime() - now.getTime()) / 1000);
  const absSec = Math.abs(diffSec);

  if (absSec < 60) {
    return relativeTimeFormatter.format(diffSec, 'second');
  }
  const diffMin = Math.round(diffSec / 60);
  if (Math.abs(diffMin) < 60) {
    return relativeTimeFormatter.format(diffMin, 'minute');
  }
  const diffHour = Math.round(diffSec / 3600);
  if (Math.abs(diffHour) < 24) {
    return relativeTimeFormatter.format(diffHour, 'hour');
  }
  const diffDay = Math.round(diffSec / 86400);
  if (Math.abs(diffDay) < 30) {
    return relativeTimeFormatter.format(diffDay, 'day');
  }
  const diffMonth = Math.round(diffSec / (86400 * 30));
  if (Math.abs(diffMonth) < 12) {
    return relativeTimeFormatter.format(diffMonth, 'month');
  }
  const diffYear = Math.round(diffSec / (86400 * 365));
  return relativeTimeFormatter.format(diffYear, 'year');
};

/** `h:mm:ss a` with spacing matching legacy moment formatting in trace lists. */
export const format12HourClockTime = (date: Date): string => {
  const hours12 = date.getHours() % 12 || 12;
  const timeStr = `${hours12}:${pad2(date.getMinutes())}:${pad2(date.getSeconds())} ${date.getHours() >= 12 ? 'pm' : 'am'}`;
  return `${timeStr.slice(0, -3)} ${timeStr.slice(-2)}`;
};

export const formatRelativeDate = (value: number | Date, fullMonthName = false): string => {
  const m = value instanceof Date ? value : new Date(value);
  const dt = new Date();
  const month: Intl.DateTimeFormatOptions['month'] = fullMonthName ? 'long' : 'short';

  if (dt.getFullYear() !== m.getFullYear()) {
    return m.toLocaleDateString(EN_LOCALE, { month, day: 'numeric', year: 'numeric' });
  }
  if (m.getMonth() === dt.getMonth() && m.getDate() === dt.getDate()) {
    return TODAY;
  }
  const yesterday = new Date(dt);
  yesterday.setDate(dt.getDate() - 1);
  if (m.getMonth() === yesterday.getMonth() && m.getDate() === yesterday.getDate()) {
    return YESTERDAY;
  }
  return m.toLocaleDateString(EN_LOCALE, { month, day: 'numeric' });
};
